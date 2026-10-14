// Run: deno test supabase/functions/parse-cv/
import { deepStrictEqual as assertEquals } from "node:assert";

import { parseContactFields } from "./parse.ts";

const CV = `
JANE SMITH
Senior Frontend Developer

Contact
Email: jane.smith@example.com
Phone: +46 70 123 45 67
LinkedIn: linkedin.com/in/jane-smith
Gothenburg, Sweden

Summary
Experienced engineer...
`;

Deno.test("extracts the four contact fields from a typical CV", () => {
  assertEquals(parseContactFields(CV), {
    full_name: "JANE SMITH",
    email: "jane.smith@example.com",
    phone: "+46 70 123 45 67",
    linkedin_url: "https://linkedin.com/in/jane-smith",
  });
});

Deno.test("adds https:// to a bare LinkedIn URL and keeps an existing one", () => {
  assertEquals(
    parseContactFields("https://www.linkedin.com/in/john-doe/").linkedin_url,
    "https://www.linkedin.com/in/john-doe",
  );
  assertEquals(
    parseContactFields("se.linkedin.com/in/anna").linkedin_url,
    "https://se.linkedin.com/in/anna",
  );
});

Deno.test("leaves fields null when nothing matches, and ignores non-name header lines", () => {
  assertEquals(parseContactFields("Curriculum Vitae\n\nExperience\n2019 - 2024"), {
    full_name: null,
    email: null,
    phone: null,
    linkedin_url: null,
  });
});

Deno.test("does not treat a long number (e.g. an ID) as a phone", () => {
  assertEquals(parseContactFields("Reference 1234567890123456789").phone, null);
});
