import type { SupabaseClient } from "@supabase/supabase-js";

import { errorResponse } from "./http.ts";

export type AdminCheck =
  | { ok: true; userId: string }
  | { ok: false; response: Response };

/**
 * Verify the caller's JWT and that their profile has role = "admin".
 * The role is always read from the database, never from the request.
 */
export async function requireAdmin(
  req: Request,
  admin: SupabaseClient,
  forbiddenMessage = "Only admins can do this",
): Promise<AdminCheck> {
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) {
    return { ok: false, response: errorResponse(401, "Missing authorization token") };
  }

  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) {
    return { ok: false, response: errorResponse(401, "Invalid or expired session") };
  }

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (profileError) {
    return { ok: false, response: errorResponse(500, "Could not verify permissions") };
  }
  if (profile?.role !== "admin") {
    return { ok: false, response: errorResponse(403, forbiddenMessage) };
  }

  return { ok: true, userId: userData.user.id };
}
