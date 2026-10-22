// Run: deno test supabase/functions/delete-user/
import { deepStrictEqual as assertEquals } from "node:assert";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createHandler } from "./handler.ts";

const ADMIN_ID = "11111111-1111-4111-8111-111111111111";
const ADMIN2_ID = "44444444-4444-4444-8444-444444444444";
const CUSTOMER_ID = "22222222-2222-4222-8222-222222222222";

type Row = {
  id: string;
  role: string;
  email: string;
  full_name?: string | null;
  organization_id?: string | null;
};

/** Minimal stand-in for the service-role client. */
function fakeClient(profiles: Row[]) {
  const deleted: string[] = [];
  const rpcCalls: { name: string; params: Record<string, unknown> }[] = [];
  const tokens: Record<string, string> = { "admin-token": ADMIN_ID, "customer-token": CUSTOMER_ID };

  const client = {
    auth: {
      getUser: (token: string) =>
        Promise.resolve(
          tokens[token]
            ? { data: { user: { id: tokens[token] } }, error: null }
            : { data: { user: null }, error: { message: "invalid JWT" } },
        ),
      admin: {
        deleteUser: (id: string) => {
          deleted.push(id);
          return Promise.resolve({ data: {}, error: null });
        },
      },
    },
    rpc: (name: string, params: Record<string, unknown>) => {
      rpcCalls.push({ name, params });
      return Promise.resolve({ error: null });
    },
    from: () => ({
      select: () => ({
        eq: (column: keyof Row, value: string) => {
          const rows = profiles.filter((p) => p[column] === value);
          // Awaitable as a list, or narrowed with maybeSingle().
          return Object.assign(Promise.resolve({ data: rows, error: null }), {
            maybeSingle: () => Promise.resolve({ data: rows[0] ?? null, error: null }),
          });
        },
      }),
    }),
  };

  return { client: client as unknown as SupabaseClient, deleted, rpcCalls };
}

const ORG_ID = "33333333-3333-4333-8333-333333333333";

const people: Row[] = [
  { id: ADMIN_ID, role: "admin", email: "admin@x.se", full_name: "Admin Person" },
  { id: CUSTOMER_ID, role: "customer", email: "anna@acme.se", full_name: "Anna Andersson", organization_id: ORG_ID },
];

function request(body: unknown, token?: string) {
  return new Request("http://localhost/delete-user", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
}

Deno.test("rejects requests without a token (401)", async () => {
  const { client, deleted } = fakeClient(people);
  const res = await createHandler(() => client)(request({ user_id: CUSTOMER_ID }));
  assertEquals(res.status, 401);
  assertEquals(deleted, []);
});

Deno.test("rejects non-admin callers (403)", async () => {
  const { client, deleted } = fakeClient(people);
  const res = await createHandler(() => client)(request({ user_id: ADMIN_ID }, "customer-token"));
  assertEquals(res.status, 403);
  assertEquals(deleted, []);
});

Deno.test("validates user_id (400)", async () => {
  const { client } = fakeClient(people);
  const res = await createHandler(() => client)(request({ user_id: "nope" }, "admin-token"));
  assertEquals(res.status, 400);
});

Deno.test("admin cannot delete themselves (400)", async () => {
  const { client, deleted } = fakeClient(people);
  const res = await createHandler(() => client)(request({ user_id: ADMIN_ID }, "admin-token"));
  assertEquals(res.status, 400);
  assertEquals((await res.json()).error, "You can't delete your own account");
  assertEquals(deleted, []);
});

Deno.test("unknown user (404)", async () => {
  const { client } = fakeClient(people);
  const res = await createHandler(() => client)(
    request({ user_id: "55555555-5555-4555-8555-555555555555" }, "admin-token"),
  );
  assertEquals(res.status, 404);
});

Deno.test("deletes a customer (200)", async () => {
  const { client, deleted } = fakeClient(people);
  const res = await createHandler(() => client)(request({ user_id: CUSTOMER_ID }, "admin-token"));
  assertEquals(res.status, 200);
  assertEquals(deleted, [CUSTOMER_ID]);
  assertEquals((await res.json()).deleted.email, "anna@acme.se");
});

Deno.test("logs the deletion with the calling admin as actor (not the deleted user)", async () => {
  const { client, rpcCalls } = fakeClient(people);
  const res = await createHandler(() => client)(request({ user_id: CUSTOMER_ID }, "admin-token"));
  assertEquals(res.status, 200);
  assertEquals(rpcCalls, [
    {
      name: "log_user_activity",
      params: {
        p_id: CUSTOMER_ID,
        p_organization_id: ORG_ID,
        p_label: "Anna Andersson",
        p_action: "deleted_permanently",
        p_actor_id: ADMIN_ID,
      },
    },
  ]);
});

Deno.test("deletes another admin when more than one exists (200)", async () => {
  const { client, deleted } = fakeClient([...people, { id: ADMIN2_ID, role: "admin", email: "a2@x.se" }]);
  const res = await createHandler(() => client)(request({ user_id: ADMIN2_ID }, "admin-token"));
  assertEquals(res.status, 200);
  assertEquals(deleted, [ADMIN2_ID]);
});
