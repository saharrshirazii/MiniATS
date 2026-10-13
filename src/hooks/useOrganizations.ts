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
};

async function fetchOrganizations(): Promise<OrganizationWithCounts[]> {
  const { data, error } = await supabase
    .from("organizations")
    .select("id, name, created_at, profiles(count), jobs(count)")
    .order("name");

  if (error) throw error;

  return data.map((org) => ({
    id: org.id,
    name: org.name,
    created_at: org.created_at,
    userCount: org.profiles[0]?.count ?? 0,
    jobCount: org.jobs[0]?.count ?? 0,
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: organizationKeys.all }),
  });
}
