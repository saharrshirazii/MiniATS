import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { corsHeaders, errorResponse, json } from "../_shared/http.ts";

/**
 * POST /functions/v1/create-user
 *
 * Admin-only. Creates an auth user (role and organization in app_metadata, which
 * users cannot change) and writes the same values to public.profiles, which is
 * what Row Level Security reads.
 *
 * Body: { email, password, role: "admin" | "customer", organization_id?, full_name? }
 */

export const createUserSchema = z
  .object({
    email: z.string().trim().toLowerCase().email("Invalid email address"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(72, "Password must be at most 72 characters"),
    role: z.enum(["admin", "customer"]),
    organization_id: z.string().uuid("Invalid organization id").nullish(),
    full_name: z.string().trim().max(200).nullish(),
  })
  .refine((data) => data.role === "admin" || !!data.organization_id, {
    message: "Customers must belong to an organization",
    path: ["organization_id"],
  });

export type CreateUserInput = z.infer<typeof createUserSchema>;

export function createHandler(getAdminClient: () => SupabaseClient) {
  return async function handler(req: Request): Promise<Response> {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }
    if (req.method !== "POST") {
      return errorResponse(405, "Method not allowed");
    }

    // 1. Who is calling? The service-role client verifies the caller's JWT.
    const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) {
      return errorResponse(401, "Missing authorization token");
    }

    const admin = getAdminClient();

    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData.user) {
      return errorResponse(401, "Invalid or expired session");
    }

    // 2. Is the caller an admin? Read the role from the database, never from the request.
    const { data: callerProfile, error: profileError } = await admin
      .from("profiles")
      .select("role")
      .eq("id", userData.user.id)
      .maybeSingle();

    if (profileError) {
      return errorResponse(500, "Could not verify permissions");
    }
    if (callerProfile?.role !== "admin") {
      return errorResponse(403, "Only admins can create accounts");
    }

    // 3. Validate the input.
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, "Request body must be JSON");
    }

    const parsed = createUserSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(400, parsed.error.issues[0]?.message ?? "Invalid input");
    }

    const { email, password, role, full_name } = parsed.data;
    // Admins are not tied to an organization.
    const organizationId = role === "customer" ? parsed.data.organization_id! : null;

    if (organizationId) {
      const { data: org, error: orgError } = await admin
        .from("organizations")
        .select("id")
        .eq("id", organizationId)
        .maybeSingle();

      if (orgError) return errorResponse(500, "Could not verify organization");
      if (!org) return errorResponse(400, "Organization not found");
    }

    // 4. Create the user. app_metadata can only be set server-side, so users
    //    can never change their own role or organization.
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { role, organization_id: organizationId },
      user_metadata: { full_name: full_name ?? null },
    });

    if (createError || !created.user) {
      if (createError?.code === "email_exists" || /already been registered/i.test(createError?.message ?? "")) {
        return errorResponse(409, "A user with this email already exists");
      }
      return errorResponse(400, createError?.message ?? "Could not create user");
    }

    // 5. Write role and organization to the profile explicitly.
    //    Supabase Auth inserts the user first and applies app_metadata in a
    //    later UPDATE, so the on_auth_user_created trigger only sees the
    //    defaults (customer, no organization). Upserting here makes the
    //    profile correct regardless of that ordering.
    const { error: profileUpsertError } = await admin.from("profiles").upsert({
      id: created.user.id,
      email,
      role,
      organization_id: organizationId,
      full_name: full_name ?? null,
    });

    if (profileUpsertError) {
      // Don't leave a login without a correct profile behind.
      await admin.auth.admin.deleteUser(created.user.id);
      return errorResponse(500, "Could not save the user's profile. Please try again.");
    }

    return json(
      {
        user: {
          id: created.user.id,
          email,
          role,
          organization_id: organizationId,
          full_name: full_name ?? null,
        },
      },
      201,
    );
  };
}
