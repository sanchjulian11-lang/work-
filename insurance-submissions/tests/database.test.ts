import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { sampleBusiness, DEMO_BROKER, DEMO_CLIENT } from "../src/lib/sample";
import { CONTRACTOR_RULES, RULE_VERSION } from "../src/lib/rules";
const db = new PGlite();
const broker = DEMO_BROKER.id,
  client = DEMO_CLIENT.id,
  other = "00000000-0000-4000-8000-000000000099";
const sample = sampleBusiness();
async function asUser(id: string, sql: string) {
  await db.exec(`set role authenticated; set request.jwt.claim.sub='${id}';`);
  try {
    return await db.query(sql);
  } finally {
    await db.exec("reset role");
  }
}
beforeAll(async () => {
  await db.exec(
    `create role anon;create role authenticated;create role service_role;create schema auth;create schema storage;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);`,
  );
  await db.exec(
    await readFile("supabase/migrations/202610220001_initial.sql", "utf8"),
  );
  await db.query("insert into organizations values($1,$2)", [
    sample.organizationId,
    "Fictional",
  ]);
  await db.query("insert into organizations values($1,$2)", [
    other,
    "Other tenant",
  ]);
  for (const [id, org, role] of [
    [broker, sample.organizationId, "broker"],
    [client, sample.organizationId, "client"],
    [other, other, "broker"],
  ]) {
    await db.query("insert into auth.users values($1)", [id]);
    await db.query("insert into memberships values($1,$2,$3)", [id, org, role]);
  }
  await db.query(
    "insert into industry_rules(version,industry,provenance,rules) values($1,$2,$3,$4)",
    [
      RULE_VERSION,
      "contractors",
      "Internal rules",
      JSON.stringify(CONTRACTOR_RULES),
    ],
  );
  await db.query(
    "insert into businesses(id,organization_id,state) values($1,$2,$3)",
    [sample.id, sample.organizationId, JSON.stringify(sample)],
  );
}, 30000);
afterAll(async () => {
  await db.close();
});
describe("real PostgreSQL migration and row-level security", () => {
  it("lets the broker read their business, never another tenant", async () => {
    expect(
      (await asUser(broker, "select * from businesses")).rows,
    ).toHaveLength(1);
    expect((await asUser(other, "select * from businesses")).rows).toHaveLength(
      0,
    );
  });
  it("exposes only assigned intake state to clients", async () => {
    expect(
      (await asUser(client, "select * from businesses")).rows,
    ).toHaveLength(0);
    const result = await asUser(client, "select state from client_businesses");
    expect(result.rows).toHaveLength(1);
    expect((result.rows[0] as { state: object }).state).not.toHaveProperty(
      "draft",
    );
    expect((result.rows[0] as { state: object }).state).not.toHaveProperty(
      "approval",
    );
  });
  it("denies browser writes and service-only mutation RPCs", async () => {
    await expect(
      asUser(client, `update businesses set state='{}'`),
    ).rejects.toThrow();
    await expect(
      asUser(broker, `select create_business('${broker}','{}')`),
    ).rejects.toThrow();
    await expect(
      asUser(
        broker,
        `insert into memberships values('${other}','${sample.organizationId}','admin')`,
      ),
    ).rejects.toThrow();
  });
  it("denies client access to audit, revisions and snapshots", async () => {
    expect(
      (await asUser(client, "select * from business_revisions")).rows,
    ).toHaveLength(0);
    expect(
      (await asUser(client, "select * from audit_events")).rows,
    ).toHaveLength(0);
    expect(
      (await asUser(client, "select * from submission_snapshots")).rows,
    ).toHaveLength(0);
  });
  it("rejects stale changes atomically and retains immutable history", async () => {
    const state = { ...sample, revision: 2 };
    await db.query("select commit_business($1,$2,$3,$4,$5,$6)", [
      broker,
      sample.id,
      JSON.stringify(sample),
      JSON.stringify(state),
      "profile",
      "{}",
    ]);
    await expect(
      db.query("select commit_business($1,$2,$3,$4,$5,$6)", [
        broker,
        sample.id,
        JSON.stringify(sample),
        JSON.stringify({ ...state, revision: 3 }),
        "profile",
        "{}",
      ]),
    ).rejects.toThrow("Stale");
    expect(
      (await db.query("select * from business_revisions")).rows,
    ).toHaveLength(2);
    expect((await db.query("select * from audit_events")).rows).toHaveLength(1);
    await expect(db.exec("delete from audit_events")).rejects.toThrow(
      "Append-only",
    );
    await expect(
      db.exec("update industry_rules set provenance='changed'"),
    ).rejects.toThrow("Append-only");
    await expect(db.exec("delete from business_revisions")).rejects.toThrow(
      "Append-only",
    );
  });
  it("validates same-organization client assignments", async () => {
    const current = (
      await db.query<{ state: typeof sample }>(
        "select state from businesses where id=$1",
        [sample.id],
      )
    ).rows[0].state;
    const next = {
      ...current,
      revision: current.revision + 1,
      assignedClientIds: [other],
    };
    await expect(
      db.query("select commit_business($1,$2,$3,$4,$5,$6)", [
        broker,
        sample.id,
        JSON.stringify(current),
        JSON.stringify(next),
        "assign_client",
        "{}",
      ]),
    ).rejects.toThrow("Invalid client assignment");
    next.assignedClientIds = [client];
    await db.query("select commit_business($1,$2,$3,$4,$5,$6)", [
      broker,
      sample.id,
      JSON.stringify(current),
      JSON.stringify(next),
      "assign_client",
      "{}",
    ]);
  });
  it("storage is private and role grants cannot call internal audit helpers", async () => {
    const result = await db.query("select public from storage.buckets");
    expect(result.rows[0]).toEqual({ public: false });
    await expect(
      asUser(
        client,
        `select append_audit('${client}','${sample.id}','fake',1,'{}')`,
      ),
    ).rejects.toThrow();
  });
});
