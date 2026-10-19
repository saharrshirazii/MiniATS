import { extractText, getDocumentProxy } from "unpdf";

/**
 * Extract plain text from a PDF's bytes. Shared by parse-cv (contact-field
 * extraction) and assess-cv (AI assessment) so both read a CV the same way.
 * Throws on a file that isn't a readable PDF.
 */
export async function extractPdfText(bytes: Uint8Array): Promise<string> {
  const pdf = await getDocumentProxy(bytes);
  const result = await extractText(pdf, { mergePages: true });
  return Array.isArray(result.text) ? result.text.join("\n") : result.text;
}
