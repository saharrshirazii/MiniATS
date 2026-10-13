import { createClient } from "@supabase/supabase-js";

import { createHandler } from "./handler.ts";

// Both variables are provided automatically by Supabase in deployed functions.
// The service role key bypasses RLS — it must only ever be used server-side.
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const handler = createHandler(() =>
  createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
);

Deno.serve(handler);
