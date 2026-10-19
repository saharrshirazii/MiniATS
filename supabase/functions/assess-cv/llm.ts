import { z } from "zod";

// Keep prompts small and cheap — a CV and a job description rarely need
// more than this to be assessed, and it caps both latency and cost.
const MAX_CV_CHARS = 12_000;
const MAX_JOB_DESCRIPTION_CHARS = 4_000;

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
// Fast, low-cost model recommended for extraction/classification-style tasks.
const MODEL = "claude-haiku-5-5";

export const aiAssessmentSchema = z.object({
  score: z.number().int().min(0).max(100),
  strengths: z.array(z.string().trim().min(1)).max(5),
  gaps: z.array(z.string().trim().min(1)).max(5),
  summary: z.string().trim().min(1).max(600),
});

export type AiAssessment = z.infer<typeof aiAssessmentSchema>;

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + "\n…(truncated)" : text;
}

/** Pull a JSON object out of the model's reply, tolerating a ```json fence. */
function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate = fenced ?? text;
  return JSON.parse(candidate.trim());
}

/**
 * Ask an LLM to assess a candidate's CV against a job, and require strict
 * JSON back: { score, strengths, gaps, summary }. The caller is responsible
 * for everything else — this never touches the database.
 */
export async function assessCv(params: {
  apiKey: string;
  cvText: string;
  jobTitle: string;
  jobDescription: string | null;
}): Promise<AiAssessment> {
  const { apiKey, cvText, jobTitle, jobDescription } = params;

  const prompt = `You are a recruiting assistant. Compare the candidate's CV below against the job and
give a fit assessment. Be concise and specific — reference actual details from the CV, not generic praise.
This is advisory only: a human recruiter makes the final decision, so flag genuine gaps rather than smoothing
them over.

Respond with ONLY a single JSON object, no other text, matching exactly this shape:
{
  "score": <integer 0-100, overall fit for this specific job>,
  "strengths": [<1 to 5 short strings, each a concrete strength relevant to this job>],
  "gaps": [<0 to 5 short strings, each a concrete gap or open question relevant to this job>],
  "summary": <one or two sentences summarizing the fit>
}

Job title: ${jobTitle}

Job description:
${jobDescription ? truncate(jobDescription, MAX_JOB_DESCRIPTION_CHARS) : "(no description provided)"}

Candidate CV text:
${truncate(cvText, MAX_CV_CHARS)}`;

  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`AI service error (${response.status}): ${body.slice(0, 300)}`);
  }

  const data = await response.json();
  const text = data?.content?.[0]?.text;
  if (typeof text !== "string") {
    throw new Error("AI service returned an unexpected response shape.");
  }

  let parsed: unknown;
  try {
    parsed = extractJson(text);
  } catch {
    throw new Error("AI service did not return valid JSON.");
  }

  const result = aiAssessmentSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error("AI service response did not match the expected schema.");
  }
  return result.data;
}
