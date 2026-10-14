import { extractText, getDocumentProxy } from "unpdf";

import { corsHeaders, errorResponse, json } from "../_shared/http.ts";
import { parseContactFields } from "./parse.ts";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * Read an uploaded CV (PDF) and return any contact details found, to pre-fill
 * the candidate form. The caller's JWT is verified by the platform
 * (verify_jwt = true), so any signed-in user may use it; it touches no data.
 */
export async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse(405, "Method not allowed");

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return errorResponse(400, "Send the CV as a file upload.");
  }

  const file = form.get("file");
  if (!(file instanceof File)) return errorResponse(400, "No CV file was provided.");
  if (file.type && file.type !== "application/pdf") {
    return errorResponse(415, "Only PDF CVs can be read.");
  }
  if (file.size > MAX_BYTES) return errorResponse(413, "The CV is too large (max 10 MB).");

  let text: string;
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const pdf = await getDocumentProxy(bytes);
    const result = await extractText(pdf, { mergePages: true });
    text = Array.isArray(result.text) ? result.text.join("\n") : result.text;
  } catch {
    return errorResponse(422, "Could not read this PDF. Please fill the form in manually.");
  }

  return json(parseContactFields(text));
}
