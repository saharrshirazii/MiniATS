// Pull contact details out of CV text. Pure string/regex only (no Deno or
// network), so it is cheap to unit test and reuse. Deliberately conservative:
// it is better to leave a field empty than to guess wrong, because the user
// reviews and completes the form afterwards.

export type ParsedContact = {
  full_name: string | null;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
};

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
// linkedin.com/in/<handle>, with or without scheme / country subdomain.
const LINKEDIN_RE = /(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/in\/[A-Za-z0-9\-_%]+\/?/i;
// A phone-like run: optional + / "(", then digits/spaces/()-. , ending in a digit.
const PHONE_RE = /\+?\(?\d[\d\s().\-]{5,}\d/g;
// Two 4-digit groups, e.g. "2019 - 2024" — a date range, not a phone number.
const YEAR_RANGE_RE = /^\d{4}\s*[-–—]\s*\d{4}$/;

// Lines that look like section headers or labels, not a person's name.
const NOT_A_NAME =
  /(curriculum|resume|résumé|\bcv\b|profile|contact|email|e-mail|phone|mobile|address|summary|experience|education|skills|linkedin|github|portfolio|www\.|http)/i;

function cleanEmail(text: string): string | null {
  return text.match(EMAIL_RE)?.[0].replace(/[.,;]+$/, "") ?? null;
}

function cleanLinkedin(text: string): string | null {
  const match = text.match(LINKEDIN_RE)?.[0];
  if (!match) return null;
  const trimmed = match.replace(/\/+$/, "").replace(/[.,;]+$/, "");
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

/** First phone-like run with 7–15 digits (avoids dates, IDs and zip codes). */
function cleanPhone(text: string): string | null {
  for (const match of text.matchAll(PHONE_RE)) {
    const raw = match[0].trim();
    if (YEAR_RANGE_RE.test(raw)) continue;
    const digits = raw.replace(/\D/g, "").length;
    if (digits >= 7 && digits <= 15) return raw.replace(/\s{2,}/g, " ");
  }
  return null;
}

/** First early line that reads like a person's name (2–4 capitalised words). */
function guessName(text: string): string | null {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 15);

  for (const line of lines) {
    if (line.length > 50 || NOT_A_NAME.test(line)) continue;
    if (/[@\d]/.test(line)) continue;
    const words = line.split(/\s+/);
    if (words.length < 2 || words.length > 4) continue;
    // Each word starts with a capital (incl. accents) or is all caps.
    if (words.every((w) => /^[A-ZÀ-Ö][A-Za-zÀ-ÿ'’.-]*$/.test(w) || /^[A-ZÀ-Ö'’.-]+$/.test(w))) {
      return line.replace(/\s{2,}/g, " ");
    }
  }
  return null;
}

export function parseContactFields(text: string): ParsedContact {
  const normalized = text.replace(/ /g, " ");
  return {
    full_name: guessName(normalized),
    email: cleanEmail(normalized),
    phone: cleanPhone(normalized),
    linkedin_url: cleanLinkedin(normalized),
  };
}
