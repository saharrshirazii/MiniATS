// Run: deno test supabase/functions/create-user/
import { deepStrictEqual as assertEquals } from "node:assert";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createHandler } from "./handler.ts";

const ADMIN_ID = "11111111-1111-4111-8111-111111111111";
const CUSTOMER_ID = "22222222-2222-4222-8222-222222222222";
const ORG_ID = "33333333-3333-4333-8333-333333333333";

type FakeOptions = { existingEmails?: string[]; failProfileUpsert?: boolean };

/**
 * Minimal stand-in for the service-role Supabase client.
 *
 * Like real Supabase Auth, createUser inserts the user BEFORE app_metadata is
 * applied, so the database trigger creates a default profile
 * (customer, no organization). The handler must correct it.
 */
function fakeClient({ existingEmails = [], failProfileUpsert = false }: FakeOptions = {}) {
  const created: Record<string, unknown>[] = [];
  const deletedUserIds: string[] = [];
  const tokens: Record<string, string> = { "admin-token": ADMIN_ID, "customer-token": CUSTOMER_ID };
  const tables: Record<string, Record<string, unknown>[]> = {
    profiles: [
      { id: ADMIN_ID, role: "admin" },
      { id: CUSTOMER_ID, role: "customer" },
    ],
    organizations: [{ id: ORG_ID }],
  };

  const client = {
    auth: {
      getUser: (token: string) =>
        Promise.resolve(
          tokens[token]
            ? { data: { user: { id: tokens[token] } }, error: null }
            : { data: { user: null }, error: { message: "invalid JWT" } },
        ),
      admin: {
        createUser: (attrs: { email: string }) => {
          if (existingEmails.includes(attrs.email)) {
            return Promise.resolve({ data: { user: null }, error: { code: "email_exists", message: "exists" } });
          }
          created.push(attrs);
          // What the on_auth_user_created trigger produces in real Supabase:
          tables.profiles.push({ id: "new-user-id", role: "customer", organization_id: null });
          return Promise.resolve({ data: { user: { id: "new-user-id" } }, error: null });
        },
        deleteUser: (id: string) => {
          deletedUserIds.push(id);
          return Promise.resolve({ data: {}, error: null });
        },
      },
    },
    from: (table: string) => ({
      upsert: (row: Record<string, unknown>) => {
        if (failProfileUpsert) return Promise.resolve({ error: { message: "db down" } });
        const rows = tables[table];
        const index = rows.findIndex((r) => r.id === row.id);
        if (index >= 0) rows[index] = { ...rows[index], ...row };
        else rows.push(row);
        return Promise.resolve({ error: null });
      },
      select: () => ({
        eq: (column: string, value: string) => ({
          maybeSingle: () =>
            Promise.resolve({
              data: tables[table]?.find((row) => row[column] === value) ?? null,
              error: null,
            }),
        }),
      }),
    }),
  };

  const profileOf = (id: string) => tables.profiles.find((p) => p.id === id);

  return { client: client as unknown as SupabaseClient, created, deletedUserIds, profileOf };
}

function request(body: unknown, token?: string, method = "POST") {
  return new Request("http://localhost/create-user", {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: method === "POST" ? JSON.stringify(body) : undefined,
  });
}

const validCustomer = {
  email: "Anna@Acme.se",
  password: "secret-password",
  role: "customer",
  organization_id: ORG_ID,
  full_name: "Anna Andersson",
};

Deno.test("OPTIONS preflight returns CORS headers", async () => {
  const handler = createHandler(() => fakeClient().client);
  const res = await handler(request(null, undefined, "OPTIONS"));
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("Access-Control-Allow-Origin"), "*");
});

Deno.test("rejects requests without a token (401)", async () => {
  const handler = createHandler(() => fakeClient().client);
  const res = await handler(request(validCustomer));
  assertEquals(res.status, 401);
});

Deno.test("rejects invalid tokens (401)", async () => {
  const handler = createHandler(() => fakeClient().client);
  const res = await handler(request(validCustomer, "bad-token"));
  assertEquals(res.status, 401);
});

Deno.test("rejects non-admin callers (403)", async () => {
  const { client, created } = fakeClient();
  const res = await createHandler(() => client)(request(validCustomer, "customer-token"));
  assertEquals(res.status, 403);
  assertEquals(created.length, 0);
});

Deno.test("validates input (400)", async () => {
  const handler = createHandler(() => fakeClient().client);
  const cases = [
    { ...validCustomer, email: "not-an-email" },
    { ...validCustomer, password: "short" },
    { ...validCustomer, role: "superuser" },
    { ...validCustomer, organization_id: undefined },
  ];
  for (const body of cases) {
    const res = await handler(request(body, "admin-token"));
    assertEquals(res.status, 400, JSON.stringify(body));
  }
});

Deno.test("rejects unknown organization (400)", async () => {
  const handler = createHandler(() => fakeClient().client);
  const res = await handler(
    request({ ...validCustomer, organization_id: "44444444-4444-4444-8444-444444444444" }, "admin-token"),
  );
  assertEquals(res.status, 400);
  assertEquals((await res.json()).error, "Organization not found");
});

Deno.test("rejects duplicate email (409)", async () => {
  const { client } = fakeClient({ existingEmails: ["anna@acme.se"] });
  const res = await createHandler(() => client)(request(validCustomer, "admin-token"));
  assertEquals(res.status, 409);
});

Deno.test("admin creates a customer (201) with role and org in app_metadata", async () => {
  const { client, created } = fakeClient();
  const res = await createHandler(() => client)(request(validCustomer, "admin-token"));
  assertEquals(res.status, 201);
  assertEquals(created[0], {
    email: "anna@acme.se", // normalized to lowercase
    password: "secret-password",
    email_confirm: true,
    app_metadata: { role: "customer", organization_id: ORG_ID },
    user_metadata: { full_name: "Anna Andersson" },
  });
});

Deno.test("admin creates another admin without organization (201)", async () => {
  const { client, created } = fakeClient();
  const res = await createHandler(() => client)(
    request({ email: "boss@x.se", password: "secret-password", role: "admin", organization_id: ORG_ID }, "admin-token"),
  );
  assertEquals(res.status, 201);
  assertEquals((created[0].app_metadata as Record<string, unknown>).organization_id, null);
});

Deno.test("profile gets the chosen role and organization (not the trigger defaults)", async () => {
  const { client, profileOf } = fakeClient();
  const res = await createHandler(() => client)(request(validCustomer, "admin-token"));
  assertEquals(res.status, 201);
  const profile = profileOf("new-user-id")!;
  assertEquals(profile.role, "customer");
  assertEquals(profile.organization_id, ORG_ID);
  assertEquals(profile.full_name, "Anna Andersson");
  assertEquals(profile.email, "anna@acme.se");
});

Deno.test("new admin's profile is admin, not the default customer", async () => {
  const { client, profileOf } = fakeClient();
  await createHandler(() => client)(
    request({ email: "boss@x.se", password: "secret-password", role: "admin" }, "admin-token"),
  );
  assertEquals(profileOf("new-user-id")!.role, "admin");
});

Deno.test("if saving the profile fails, the new login is deleted (500)", async () => {
  const { client, deletedUserIds } = fakeClient({ failProfileUpsert: true });
  const res = await createHandler(() => client)(request(validCustomer, "admin-token"));
  assertEquals(res.status, 500);
  assertEquals(deletedUserIds, ["new-user-id"]);
});
