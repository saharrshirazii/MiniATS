import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { requireAdmin } from "../_shared/auth.ts";
import { corsHeaders, errorResponse, json } from "../_shared/http.ts";

/**
 * POST /functions/v1/delete-user
 *
 * Admin-only. Deletes the auth user; the profile is removed by its
 * ON DELETE CASCADE foreign key. Jobs/candidates keep existing
 * (their created_by becomes null).
 *
 * Body: { user_id }
 */

export const deleteUserSchema = z.object({
  user_id: z.string().uuid("Invalid user id"),
});

export function createHandler(getAdminClient: () => SupabaseClient) {
  return async function handler(req: Request): Promise<Response> {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }
    if (req.method !== "POST") {
      return errorResponse(405, "Method not allowed");
    }

    const admin = getAdminClient();
    const check = await requireAdmin(req, admin, "Only admins can delete accounts");
    if (!check.ok) return check.response;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, "Request body must be JSON");
    }

    const parsed = deleteUserSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(400, parsed.error.issues[0]?.message ?? "Invalid input");
    }
    const { user_id: targetId } = parsed.data;

    if (targetId === check.userId) {
      return errorResponse(400, "You can't delete your own account");
    }

    const { data: target, error: targetError } = await admin
      .from("profiles")
      .select("id, email, full_name, organization_id")
      .eq("id", targetId)
      .maybeSingle();

    if (targetError) return errorResponse(500, "Could not load the user");
    if (!target) return errorResponse(404, "User not found");

    // No "last admin" check needed here: the caller is an admin and can't delete
    // themselves, so another admin always remains. The protect_last_admin
    // database trigger still guards against races (two admins deleting each other).

    const { error: deleteError } = await admin.auth.admin.deleteUser(targetId);
    if (deleteError) {
      return errorResponse(500, `Could not delete user: ${deleteError.message}`);
    }

    // Record this in the activity log, using the snapshot captured above
    // (the row is gone now via ON DELETE CASCADE). Same reasoning as
    // create-user: service-role key means no auth.uid(), so the verified
    // admin's id is passed in explicitly; best-effort, since the account
    // is already deleted either way.
    await admin.rpc("log_user_activity", {
      p_id: targetId,
      p_organization_id: target.organization_id,
      p_label: target.full_name || target.email,
      p_action: "deleted_permanently",
      p_actor_id: check.userId,
    });

    return json({ deleted: { id: targetId, email: target.email } });
  };
}
