import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import { corsHeaders, errorResponse, json } from "../_shared/http.ts";
import { extractPdfText as extractPdfTextDefault } from "../_shared/pdf.ts";
import { assessCv, type AiAssessment } from "./llm.ts";

/**
 * POST /functions/v1/assess-cv
 *
 * Any signed-in user with access to the application (customer in that
 * organization, or admin). No separate role check is needed: the client
 * below is built from the caller's own JWT, so every query runs under their
 * identity and Postgres/Storage RLS does the scoping exactly as it would
 * for a direct browser query — the same approach as `parse-cv`.
 *
 * Downloads the candidate's CV, extracts its text, sends it with the job's
 * title/description to an LLM, and saves the result on the application row.
 * Body: { applicationId }
 */

export const assessCvSchema = z.object({
  applicationId: z.string().uuid("Invalid application id"),
});

type AssessFn = (params: {
  apiKey: string;
  cvText: string;
  jobTitle: string;
  jobDescription: string | null;
}) => Promise<AiAssessment>;

export function createHandler(opts: {
  supabaseUrl: string;
  anonKey: string;
  anthropicApiKey: string | undefined;
  /** Injectable for tests; defaults to the real Anthropic call. */
  assess?: AssessFn;
  /** Injectable for tests; defaults to a real Supabase client scoped to the caller's JWT. */
  getClient?: (authHeader: string) => SupabaseClient;
  /** Injectable for tests; defaults to the real PDF text extraction. */
  extractPdfText?: (bytes: Uint8Array) => Promise<string>;
}) {
  const assess = opts.assess ?? assessCv;
  const extractPdfText = opts.extractPdfText ?? extractPdfTextDefault;
  const getClient =
    opts.getClient ??
    ((authHeader: string) =>
      createClient(opts.supabaseUrl, opts.anonKey, {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false, autoRefreshToken: false },
      }));

  return async function handler(req: Request): Promise<Response> {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (req.method !== "POST") return errorResponse(405, "Method not allowed");

    if (!opts.anthropicApiKey) {
      return errorResponse(
        500,
        "AI assessment is not configured. Set the ANTHROPIC_API_KEY secret.",
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return errorResponse(401, "Missing authorization token");

    const supabase: SupabaseClient = getClient(authHeader);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, "Request body must be JSON");
    }
    const parsed = assessCvSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(400, parsed.error.issues[0]?.message ?? "Invalid input");
    }

    // RLS scopes this to the caller's organization (or every org for an
    // admin); a row outside that scope, or a missing id, both come back as
    // zero rows rather than an error.
    const { data, error: fetchError } = await supabase
      .from("applications")
      .select(
        "id, job:jobs!inner(id, title, description), candidate:candidates!inner(id, full_name, cv_path)",
      )
      .eq("id", parsed.data.applicationId)
      .maybeSingle();

    if (fetchError) return errorResponse(500, "Could not load this application.");
    if (!data) {
      return errorResponse(404, "Application not found, or you don't have access to it.");
    }

    // The untyped SupabaseClient can't infer that `!inner` makes these
    // single objects rather than arrays — assert the shape we actually get.
    const application = data as unknown as {
      id: string;
      job: { id: string; title: string; description: string | null };
      candidate: { id: string; full_name: string; cv_path: string | null };
    };
    const { job, candidate } = application;
    if (!candidate.cv_path) {
      return errorResponse(400, `${candidate.full_name} has no CV uploaded yet.`);
    }

    const { data: file, error: downloadError } = await supabase.storage
      .from("cvs")
      .download(candidate.cv_path);
    if (downloadError || !file) {
      return errorResponse(404, "Could not find this candidate's CV file in storage.");
    }

    let cvText: string;
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      cvText = await extractPdfText(bytes);
    } catch {
      return errorResponse(422, "Could not read this candidate's CV.");
    }
    if (!cvText.trim()) {
      return errorResponse(
        422,
        "This CV has no extractable text (it may be a scanned image, not a text PDF).",
      );
    }

    let assessment;
    try {
      assessment = await assess({
        apiKey: opts.anthropicApiKey,
        cvText,
        jobTitle: job.title,
        jobDescription: job.description,
      });
    } catch (err) {
      return errorResponse(
        502,
        err instanceof Error ? err.message : "The AI assessment failed. Please try again.",
      );
    }

    const ai_assessed_at = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("applications")
      .update({
        ai_score: assessment.score,
        ai_summary: assessment.summary,
        ai_strengths: assessment.strengths,
        ai_gaps: assessment.gaps,
        ai_assessed_at,
      })
      .eq("id", application.id);

    if (updateError) {
      return errorResponse(500, "Assessed, but could not save the result. Please try again.");
    }

    return json({
      ai_score: assessment.score,
      ai_summary: assessment.summary,
      ai_strengths: assessment.strengths,
      ai_gaps: assessment.gaps,
      ai_assessed_at,
    });
  };
}
