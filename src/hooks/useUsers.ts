import { FunctionsHttpError } from "@supabase/supabase-js";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import type { Enums, Tables } from "@/types/database.types";

import { organizationKeys } from "./useOrganizations";

export const userKeys = {
  all: ["users"] as const,
};

export type UserWithOrganization = Tables<"profiles"> & {
  organization: { name: string } | null;
};

async function fetchUsers(): Promise<UserWithOrganization[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*, organization:organizations(name)")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

/** All user profiles. Only admins see every profile (RLS). */
export function useUsers() {
  return useQuery({
    queryKey: userKeys.all,
    queryFn: fetchUsers,
  });
}

export type CreateUserInput = {
  email: string;
  password: string;
  role: Enums<"user_role">;
  organization_id: string | null;
  full_name: string | null;
};

type CreateUserResponse = {
  user: { id: string; email: string; role: Enums<"user_role">; organization_id: string | null };
};

/** Read the `{ error }` message our Edge Function returns on 4xx/5xx. */
async function functionErrorMessage(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    const body: unknown = await error.context.json().catch(() => null);
    if (body && typeof body === "object" && "error" in body && typeof body.error === "string") {
      return body.error;
    }
  }
  return error instanceof Error ? error.message : "Could not create user";
}

/** Create an account through the admin-only `create-user` Edge Function. */
export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateUserInput) => {
      const { data, error } = await supabase.functions.invoke<CreateUserResponse>("create-user", {
        body: input,
      });

      if (error) throw new Error(await functionErrorMessage(error));
      return data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.all });
      queryClient.invalidateQueries({ queryKey: organizationKeys.all }); // user counts
    },
  });
}
