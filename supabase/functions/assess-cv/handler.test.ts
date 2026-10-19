// Run: deno test supabase/functions/assess-cv/
import { deepStrictEqual as assertEquals, ok as assertOk } from "node:assert";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createHandler } from "./handler.ts";
import type { AiAssessment } from "./llm.ts";

const APP_ID = "11111111-1111-4111-8111-111111111111";
const JOB = { id: "job-1", title: "Frontend Developer", description: "React, TypeScript." };
const CANDIDATE_WITH_CV = {
  id: "cand-1",
  full_name: "Erik Andersson",
  cv_path: "org-1/cand-1.pdf",
};
const CANDIDATE_NO_CV = { id: "cand-2", full_name: "Lisa Berg", cv_path: null };

type FakeApplication = {
  id: string;
  job: typeof JOB;
  candidate: { id: string; full_name: string; cv_path: string | null };
};

type FakeOptions = {
  application?: FakeApplication | null;
  downloadFails?: boolean;
  updateFails?: boolean;
};

/** Minimal stand-in for a Supabase client scoped to the caller's JWT. */
function fakeClient({ application, downloadFails = false, updateFails = false }: FakeOptions = {}) {
  const updates: Record<string, unknown>[] = [];
  const row =
    application === undefined
      ? { id: APP_ID, job: JOB, candidate: CANDIDATE_WITH_CV }
      : application;

  const client = {
    from: (table: string) => {
      if (table !== "applications") throw new Error(`Unexpected table: ${table}`);
      return {
        select: () => ({
          eq: (_col: string, value: string) => ({
            maybeSingle: () =>
              Promise.resolve({ data: row && row.id === value ? row : null, error: null }),
          }),
        }),
        update: (fields: Record<string, unknown>) => ({
          eq: (_col: string, _value: string) => {
            updates.push(fields);
            return Promise.resolve(
              updateFails ? { error: { message: "db down" } } : { error: null },
            );
          },
        }),
      };
    },
    storage: {
      from: (_bucket: string) => ({
        download: () =>
          downloadFails
            ? Promise.resolve({ data: null, error: { message: "not found" } })
            : Promise.resolve({
                data: { arrayBuffer: () => Promise.resolve(new ArrayBuffer(4)) },
                error: null,
              }),
      }),
    },
  };

  return { client: client as unknown as SupabaseClient, updates };
}

const FAKE_ASSESSMENT: AiAssessment = {
  score: 82,
  strengths: ["5 years React experience", "Strong TypeScript background"],
  gaps: ["No backend experience mentioned"],
  summary: "Strong frontend fit; limited backend exposure.",
};

function handlerWith(opts: {
  application?: FakeOptions["application"];
  downloadFails?: boolean;
  updateFails?: boolean;
  anthropicApiKey?: string | undefined;
  assessError?: Error;
  cvText?: string;
}) {
  const { client, updates } = fakeClient(opts);
  const assess = opts.assessError
    ? () => Promise.reject(opts.assessError)
    : () => Promise.resolve(FAKE_ASSESSMENT);

  const handler = createHandler({
    supabaseUrl: "http://localhost",
    anonKey: "anon-key",
    anthropicApiKey: "anthropicApiKey" in opts ? opts.anthropicApiKey : "test-api-key",
    assess,
    getClient: () => client,
    extractPdfText: () => Promise.resolve(opts.cvText ?? "Erik Andersson — 5 years of React."),
  });

  return { handler, updates };
}

function request(body: unknown, token?: string, method = "POST") {
  return new Request("http://localhost/assess-cv", {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: method === "POST" ? JSON.stringify(body) : undefined,
  });
}

Deno.test("OPTIONS preflight returns CORS headers", async () => {
  const { handler } = handlerWith({});
  const res = await handler(request(null, undefined, "OPTIONS"));
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
});

Deno.test("rejects requests without a token (401)", async () => {
  const { handler } = handlerWith({});
  const res = await handler(request({ applicationId: APP_ID }));
  assertEquals(res.status, 401);
});

Deno.test("500 when the API key secret is not set", async () => {
  const { handler } = handlerWith({ anthropicApiKey: undefined });
  const res = await handler(request({ applicationId: APP_ID }, "token"));
  assertEquals(res.status, 500);
});

Deno.test("validates input (400)", async () => {
  const { handler } = handlerWith({});
  const res = await handler(request({ applicationId: "not-a-uuid" }, "token"));
  assertEquals(res.status, 400);
});

Deno.test("404 when the application isn't found or isn't visible (RLS)", async () => {
  const { handler } = handlerWith({ application: null });
  const res = await handler(request({ applicationId: APP_ID }, "token"));
  assertEquals(res.status, 404);
});

Deno.test("400 when the candidate has no CV", async () => {
  const { handler } = handlerWith({
    application: { id: APP_ID, job: JOB, candidate: CANDIDATE_NO_CV },
  });
  const res = await handler(request({ applicationId: APP_ID }, "token"));
  assertEquals(res.status, 400);
  assertOk((await res.json()).error.includes("no CV"));
});

Deno.test("404 when the CV can't be downloaded from storage", async () => {
  const { handler } = handlerWith({ downloadFails: true });
  const res = await handler(request({ applicationId: APP_ID }, "token"));
  assertEquals(res.status, 404);
});

Deno.test("422 when the CV has no extractable text (scanned image)", async () => {
  const { handler } = handlerWith({ cvText: "   " });
  const res = await handler(request({ applicationId: APP_ID }, "token"));
  assertEquals(res.status, 422);
});

Deno.test("502 when the LLM call fails", async () => {
  const { handler } = handlerWith({ assessError: new Error("rate limited") });
  const res = await handler(request({ applicationId: APP_ID }, "token"));
  assertEquals(res.status, 502);
  assertEquals((await res.json()).error, "rate limited");
});

Deno.test("500 when the assessment can't be saved", async () => {
  const { handler } = handlerWith({ updateFails: true });
  const res = await handler(request({ applicationId: APP_ID }, "token"));
  assertEquals(res.status, 500);
});

Deno.test("happy path: saves and returns the assessment (200)", async () => {
  const { handler, updates } = handlerWith({});
  const res = await handler(request({ applicationId: APP_ID }, "token"));
  assertEquals(res.status, 200);

  const body = await res.json();
  assertEquals(body.ai_score, FAKE_ASSESSMENT.score);
  assertEquals(body.ai_summary, FAKE_ASSESSMENT.summary);
  assertEquals(body.ai_strengths, FAKE_ASSESSMENT.strengths);
  assertEquals(body.ai_gaps, FAKE_ASSESSMENT.gaps);
  assertOk(typeof body.ai_assessed_at === "string");

  assertEquals(updates.length, 1);
  assertEquals(updates[0].ai_score, FAKE_ASSESSMENT.score);
  assertEquals(updates[0].ai_strengths, FAKE_ASSESSMENT.strengths);
});
