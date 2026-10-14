import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";

export const organizationKeys = {
  all: ["organizations"] as const,
};

export type OrganizationWithCounts = {
  id: string;
  name: string;
  created_at: string;
  userCount: number;
  jobCount: number;
  candidateCount: number;
};

async function fetchOrganizations(): Promise<OrganizationWithCounts[]> {
  const { data, error } = await supabase
    .from("organizations")
    .select(
      "id, name, created_at, profiles(count), jobs(count), candidates(count)",
    )
    .order("name");

  if (error) throw error;

  return data.map((org) => ({
    id: org.id,
    name: org.name,
    created_at: org.created_at,
    userCount: org.profiles[0]?.count ?? 0,
    jobCount: org.jobs[0]?.count ?? 0,
    candidateCount: org.candidates[0]?.count ?? 0,
  }));
}

/** All organizations the current user can see (admins: all; customers: their own). */
export function useOrganizations() {
  return useQuery({
    queryKey: organizationKeys.all,
    queryFn: fetchOrganizations,
  });
}

export function useCreateOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase
        .from("organizations")
        .insert({ name: name.trim() })
        .select("id, name")
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: organizationKeys.all }),
  });
}

export function useUpdateOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { data, error } = await supabase
        .from("organizations")
        .update({ name: name.trim() })
        .eq("id", id)
        .select("id, name")
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.all });
      queryClient.invalidateQueries({ queryKey: ["users"] }); // users list shows org names
    },
  });
}

/**
 * Delete an organization. The database refuses (SQLSTATE 23001) while it still
 * has users, jobs or candidates; that message is passed on to the user.
 */
export function useDeleteOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from("organizations")
        .delete()
        .eq("id", id)
        .select("id");

      if (error) {
        if (error.code === "23001") throw new Error(error.message);
        throw new Error(`Could not delete organization: ${error.message}`);
      }
      // RLS hides rows the caller may not delete, which returns 0 rows instead of an error.
      if (data.length === 0) {
        throw new Error(
          "Organization not found, or you are not allowed to delete it.",
        );
      }
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: organizationKeys.all }),
  });
}
