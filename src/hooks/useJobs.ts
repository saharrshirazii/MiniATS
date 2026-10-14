import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import type { Enums, Tables } from "@/types/database.types";

import { organizationKeys } from "./useOrganizations";

export type JobStatus = Enums<"job_status">;

export type JobWithCounts = Pick<
  Tables<"jobs">,
  "id" | "organization_id" | "title" | "location" | "workplace_type" | "description" | "status" | "created_at"
> & { candidateCount: number };

export const jobKeys = {
  all: ["jobs"] as const,
  byOrg: (orgId: string) => ["jobs", orgId] as const,
};

async function fetchJobs(orgId: string): Promise<JobWithCounts[]> {
  const { data, error } = await supabase
    .from("jobs")
    .select(
      "id, organization_id, title, location, workplace_type, description, status, created_at, applications(count)",
    )
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return data.map(({ applications, ...job }) => ({
    ...job,
    candidateCount: applications[0]?.count ?? 0,
  }));
}

/** Jobs of one organization (the active one), newest first. */
export function useJobs(orgId: string | null) {
  return useQuery({
    queryKey: jobKeys.byOrg(orgId ?? "none"),
    queryFn: () => fetchJobs(orgId!),
    enabled: !!orgId,
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
    mutationFn: async ({ orgId, ...job }: JobInput & { orgId: string }) => {
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
    mutationFn: async ({ id, ...changes }: Partial<JobInput> & { id: string; status?: JobStatus }) => {
      const { data, error } = await supabase
        .from("jobs")
        .update(changes)
        .eq("id", id)
        .select("id");

      if (error) throw new Error(`Could not update job: ${error.message}`);
      if (data.length === 0) throw new Error("Job not found, or you are not allowed to edit it.");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: jobKeys.all }),
  });
}
