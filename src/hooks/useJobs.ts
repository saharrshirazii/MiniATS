import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import type { Enums, Tables } from "@/types/database.types";

import { organizationKeys } from "./useOrganizations";

export type JobStatus = Enums<"job_status">;

export type JobWithCounts = Pick<
  Tables<"jobs">,
  | "id"
  | "organization_id"
  | "title"
  | "location"
  | "workplace_type"
  | "description"
  | "status"
  | "created_at"
  | "created_by_email"
> & { candidateCount: number; organizationName: string | null };

export const jobKeys = {
  all: ["jobs"] as const,
  byOrg: (orgId: string) => ["jobs", orgId] as const,
};

/** orgId = one organization; null = every organization the caller can see (admins: all). */
async function fetchJobs(orgId: string | null): Promise<JobWithCounts[]> {
  let query = supabase
    .from("jobs")
    .select(
      "id, organization_id, title, location, workplace_type, description, status, created_at, created_by_email, applications(count), organization:organizations(name)",
    )
    .order("created_at", { ascending: false });

  if (orgId) query = query.eq("organization_id", orgId);

  const { data, error } = await query;
  if (error) throw error;

  return data.map(({ applications, organization, ...job }) => ({
    ...job,
    candidateCount: applications[0]?.count ?? 0,
    organizationName: organization?.name ?? null,
  }));
}

/**
 * Jobs of the active organization, or of all organizations (admin "All"),
 * newest first. Disabled while there is neither.
 */
export function useJobs(scope: { orgId: string | null; all: boolean }) {
  const { orgId, all } = scope;
  return useQuery({
    queryKey: jobKeys.byOrg(all ? "all" : (orgId ?? "none")),
    queryFn: () => fetchJobs(all ? null : orgId),
    enabled: all || !!orgId,
  });
}

export type JobInput = {
  title: string;
  location: string | null;
  workplace_type: Enums<"workplace_type"> | null;
  description: string | null;
};

export function useCreateJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ orgId, ...job }: JobInput & { orgId: string; status: JobStatus }) => {
      const { data, error } = await supabase
        .from("jobs")
        .insert({ ...job, organization_id: orgId })
        .select("id, title")
        .single();

      if (error) throw new Error(`Could not create job: ${error.message}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: jobKeys.all });
      queryClient.invalidateQueries({ queryKey: organizationKeys.all }); // job counts
    },
  });
}

/** Edit a job's details and/or open/close it. */
export function useUpdateJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...changes
    }: Partial<JobInput> & { id: string; status?: JobStatus }) => {
      const { data, error } = await supabase.from("jobs").update(changes).eq("id", id).select("id");

      if (error) throw new Error(`Could not update job: ${error.message}`);
      if (data.length === 0) throw new Error("Job not found, or you are not allowed to edit it.");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: jobKeys.all }),
  });
}

/**
 * Delete a job. Its pipeline entries (applications) are removed with it;
 * the candidates themselves stay in the organization.
 */
export function useDeleteJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.from("jobs").delete().eq("id", id).select("id");

      if (error) throw new Error(`Could not delete job: ${error.message}`);
      if (data.length === 0) throw new Error("Job not found, or you are not allowed to delete it.");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: jobKeys.all });
      queryClient.invalidateQueries({ queryKey: organizationKeys.all }); // job counts
    },
  });
}
