import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import type { Enums, Tables } from "@/types/database.types";

export type ApplicationStage = Enums<"application_stage">;

export type ApplicationCard = Pick<Tables<"applications">, "id" | "stage" | "position"> & {
  job: { id: string; title: string };
  candidate: {
    id: string;
    full_name: string;
    linkedin_url: string | null;
    cv_path: string | null;
  };
};

export const applicationKeys = {
  all: ["applications"] as const,
  byOrg: (scope: string) => ["applications", scope] as const,
};

async function fetchApplications(orgId: string): Promise<ApplicationCard[]> {
  // applications has no organization_id; scope through the job (RLS enforces
  // this too, but filtering here keeps the query to one organization's rows).
  const { data, error } = await supabase
    .from("applications")
    .select(
      "id, stage, position, job:jobs!inner(id, title, organization_id, deleted_at), candidate:candidates(id, full_name, linkedin_url, cv_path)",
    )
    .eq("job.organization_id", orgId)
    .is("job.deleted_at", null)
    .order("position", { ascending: true });

  if (error) throw error;

  // The inner join guarantees job/candidate are present; narrow the types.
  return data.map(({ job, candidate, ...app }) => ({
    ...app,
    job: { id: job.id, title: job.title },
    candidate,
  }));
}

/** The pipeline (all applications) for one organization, newest-first within each stage by position. */
export function useApplications(orgId: string | null) {
  return useQuery({
    queryKey: applicationKeys.byOrg(orgId ?? "none"),
    queryFn: () => fetchApplications(orgId!),
    enabled: !!orgId,
  });
}

type MoveVars = {
  id: string;
  orgId: string;
  stage: ApplicationStage;
  position: number;
  /** Other cards whose position changed because of this move (same org query cache). */
  reordered?: { id: string; position: number }[];
};

/**
 * Move a card to a stage/position. Optimistic: the board updates
 * immediately and rolls back if the save fails.
 */
export function useMoveApplication() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, stage, position, reordered = [] }: MoveVars) => {
      const { error } = await supabase
        .from("applications")
        .update({ stage, position })
        .eq("id", id);
      if (error) throw error;

      if (reordered.length > 0) {
        const results = await Promise.all(
          reordered.map(({ id: rid, position: rpos }) =>
            supabase.from("applications").update({ position: rpos }).eq("id", rid),
          ),
        );
        const failed = results.find((r) => r.error);
        if (failed?.error) throw failed.error;
      }
    },
    onMutate: async ({ id, orgId, stage, position, reordered = [] }) => {
      const key = applicationKeys.byOrg(orgId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<ApplicationCard[]>(key);

      queryClient.setQueryData<ApplicationCard[]>(key, (current) => {
        if (!current) return current;
        const positions = new Map(reordered.map((r) => [r.id, r.position]));
        return current.map((app) => {
          if (app.id === id) return { ...app, stage, position };
          if (positions.has(app.id)) return { ...app, position: positions.get(app.id)! };
          return app;
        });
      });

      return { previous, key };
    },
    onError: (_err, _vars, context) => {
      if (context) queryClient.setQueryData(context.key, context.previous);
    },
    onSettled: (_data, _err, { orgId }) => {
      queryClient.invalidateQueries({ queryKey: applicationKeys.byOrg(orgId) });
    },
  });
}
