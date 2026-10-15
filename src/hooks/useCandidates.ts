import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import type { Enums, Tables } from "@/types/database.types";

import { jobKeys } from "./useJobs";

export type ApplicationStage = Enums<"application_stage">;

/** One job this candidate is in the pipeline for. `job` is null if the job is hidden from the caller. */
export type CandidateApplication = {
  stage: ApplicationStage;
  job: { id: string; title: string } | null;
};

export type CandidateWithApplications = Pick<
  Tables<"candidates">,
  | "id"
  | "organization_id"
  | "full_name"
  | "email"
  | "phone"
  | "linkedin_url"
  | "cv_path"
  | "notes"
  | "created_at"
> & { applications: CandidateApplication[]; organizationName: string | null };

export const candidateKeys = {
  all: ["candidates"] as const,
  byOrg: (scope: string) => ["candidates", scope] as const,
};

async function fetchCandidates(orgId: string | null): Promise<CandidateWithApplications[]> {
  let query = supabase
    .from("candidates")
    .select(
      "id, organization_id, full_name, email, phone, linkedin_url, cv_path, notes, created_at, applications(stage, job:jobs(id, title)), organization:organizations(name)",
    )
    .order("created_at", { ascending: false });

  if (orgId) query = query.eq("organization_id", orgId);

  const { data, error } = await query;
  if (error) throw error;

  return data.map(({ applications, organization, ...candidate }) => ({
    ...candidate,
    applications: applications as CandidateApplication[],
    organizationName: organization?.name ?? null,
  }));
}

/** orgId = one organization; null = every organization the caller can see (admins: all). */
export function useCandidates(scope: { orgId: string | null; all: boolean }) {
  const { orgId, all } = scope;
  return useQuery({
    queryKey: candidateKeys.byOrg(all ? "all" : (orgId ?? "none")),
    queryFn: () => fetchCandidates(all ? null : orgId),
    enabled: all || !!orgId,
  });
}

export type CandidateInput = {
  full_name: string;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  notes: string | null;
  /** When set, the candidate is added to this job's pipeline (stage "applied"). */
  jobId: string | null;
  orgId: string;
  /** The PDF attached in the form, if any. Stored as "<orgId>/<candidateId>.pdf". */
  cvFile?: File | null;
};

/** Where a candidate's CV lives in the private "cvs" bucket. */
export const cvPath = (orgId: string, candidateId: string) => `${orgId}/${candidateId}.pdf`;

/**
 * Create a candidate, and — if a job was chosen — add them to that job's
 * pipeline. If the pipeline insert fails the new candidate is removed again,
 * so we never leave a half-linked record behind. A CV upload failure does
 * NOT roll back the candidate — the record is still useful without it —
 * but is reported back via `cvError` so the caller can warn the user.
 */
export function useCreateCandidate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ jobId, orgId, cvFile, ...fields }: CandidateInput) => {
      const { data: candidate, error } = await supabase
        .from("candidates")
        .insert({ ...fields, organization_id: orgId })
        .select("id, full_name")
        .single();
      if (error) throw error;

      if (jobId) {
        const { error: appError } = await supabase
          .from("applications")
          .insert({ job_id: jobId, candidate_id: candidate.id, stage: "applied" });
        if (appError) {
          await supabase.from("candidates").delete().eq("id", candidate.id);
          throw appError;
        }
      }

      let cvError: string | null = null;
      if (cvFile) {
        const path = cvPath(orgId, candidate.id);
        const { error: uploadError } = await supabase.storage
          .from("cvs")
          .upload(path, cvFile, { contentType: "application/pdf", upsert: true });
        if (uploadError) {
          cvError = uploadError.message;
        } else {
          const { error: pathError } = await supabase
            .from("candidates")
            .update({ cv_path: path })
            .eq("id", candidate.id);
          if (pathError) cvError = pathError.message;
        }
      }

      return { ...candidate, cvError };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: candidateKeys.all });
      // The job's candidate count changed.
      queryClient.invalidateQueries({ queryKey: jobKeys.all });
    },
  });
}

export type CandidateUpdateInput = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  notes: string | null;
};

/** Edit a candidate's own fields. Their organization and pipeline entries are untouched. */
export function useUpdateCandidate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...fields }: CandidateUpdateInput) => {
      const { error } = await supabase.from("candidates").update(fields).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: candidateKeys.all });
    },
  });
}

export function useDeleteCandidate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("candidates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: candidateKeys.all });
      queryClient.invalidateQueries({ queryKey: jobKeys.all });
    },
  });
}

export type ParsedCv = {
  full_name: string | null;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
};

/** Send a CV (PDF) to the parse-cv Edge Function and get back any contact details found. */
export function useParseCv() {
  return useMutation({
    mutationFn: async (file: File): Promise<ParsedCv> => {
      const body = new FormData();
      body.append("file", file);
      const { data, error } = await supabase.functions.invoke<ParsedCv>("parse-cv", { body });
      if (error) throw new Error(await readFunctionError(error));
      return data ?? { full_name: null, email: null, phone: null, linkedin_url: null };
    },
  });
}

/**
 * Get a short-lived signed URL for a candidate's stored CV. The bucket is
 * private, so viewing always goes through a fresh, expiring link rather
 * than a permanent one.
 */
export function useCvSignedUrl() {
  return useMutation({
    mutationFn: async (path: string) => {
      const { data, error } = await supabase.storage.from("cvs").createSignedUrl(path, 60);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}

/** Pull the message out of a FunctionsHttpError body, falling back to its own message. */
async function readFunctionError(error: unknown): Promise<string> {
  const context = (error as { context?: Response }).context;
  if (context && typeof context.json === "function") {
    try {
      const body = await context.json();
      if (body?.error) return body.error as string;
    } catch {
      // Not JSON; fall through.
    }
  }
  return error instanceof Error ? error.message : "Could not read the CV.";
}
