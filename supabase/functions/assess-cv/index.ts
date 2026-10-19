import { createHandler } from "./handler.ts";

// Provided automatically by Supabase in deployed functions.
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
// Set manually: `supabase secrets set ANTHROPIC_API_KEY=sk-ant-...`
const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY");

const handler = createHandler({ supabaseUrl, anonKey, anthropicApiKey });

Deno.serve(handler);
