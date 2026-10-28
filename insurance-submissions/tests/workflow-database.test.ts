import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { approvedPilot } from "./workflow-fixture";
import {
  DEMO_BROKER as broker,
  DEMO_CLIENT as client,
} from "../src/lib/sample";
import { RULESETS } from "../src/lib/rules";
import { issueInvitation } from "../src/lib/invitations";
import { saveIntakeResponse } from "../src/lib/intake-workflow";
import type { BusinessState } from "../src/lib/types";

const db = new PGlite(),
  initial = { ...approvedPilot(), assignedClientIds: [] };
const otherOrg = randomUUID(),
  otherBroker = randomUUID(),
  wrong = randomUUID(),
  unconfirmed = randomUUID(),
  crossOrgClient = randomUUID();
async function role<T>(name: string, fn: () => Promise<T>) {
  await db.exec(`set role ${name}`);
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
  }
}
async function current() {
  return (
    await db.query<{ state: BusinessState }>(
      "select state from businesses where id=$1",
      [initial.id],
    )
  ).rows[0].state;
}
async function invite(email = "client@fictional.example") {
  const s = await current(),
    i = issueInvitation(broker, s, email, 7);
  await role("service_role", () =>
    db.query("select issue_intake_invitation($1,$2,$3)", [
      broker.id,
      JSON.stringify(s),
      JSON.stringify(i.invitation),
    ]),
  );
  return i;
}
async function claim(id: string, hash: string) {
  return role("service_role", () =>
    db.query("select claim_intake_invitation($1,$2)", [id, hash]),
  );
}
beforeAll(async () => {
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth;create schema storage;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);`);
  await db.exec(
    await readFile("supabase/migrations/202610220001_initial.sql", "utf8"),
  );
  await db.exec(
    await readFile(
      "supabase/migrations/202610270001_client_workflow.sql",
      "utf8",
    ),
  );
  for (const [id, email, confirmed] of [
    [broker.id, "broker@fictional.example", true],
    [client.id, "client@fictional.example", true],
    [otherBroker, "otherbroker@fictional.example", true],
    [wrong, "wrong@fictional.example", true],
    [unconfirmed, "unconfirmed@fictional.example", false],
    [crossOrgClient, "crossorg@fictional.example", true],
  ] as const)
    await db.query("insert into auth.users values($1,$2,$3)", [
      id,
      email,
      confirmed ? new Date().toISOString() : null,
    ]);
  await db.query("insert into organizations values($1,$2),($3,$4)", [
    initial.organizationId,
    "Fictional workflow organization",
    otherOrg,
    "Another fictional organization",
  ]);
  await db.query(
    "insert into memberships values($1,$2,'broker'),($3,$4,'broker'),($5,$4,'client')",
    [broker.id, initial.organizationId, otherBroker, otherOrg, crossOrgClient],
  );
  await db.query(
    "insert into industry_rules(version,industry,provenance,rules) values($1,$2,$3,$4)",
    [
      initial.rulesVersion,
      "commercial",
      "Internal intake, insurer-specific requirements not assessed",
      JSON.stringify(RULESETS[initial.rulesVersion]),
    ],
  );
  await db.query(
    "insert into businesses(id,organization_id,state) values($1,$2,$3)",
    [initial.id, initial.organizationId, JSON.stringify(initial)],
  );
}, 30000);
afterAll(() => db.close());
describe("workflow migration, real PostgreSQL authorization and atomicity", () => {
  it("denies invitation reads/writes and RPC calls to browser roles", async () => {
    for (const name of ["anon", "authenticated"]) {
      await expect(
        role(name, () => db.query("select * from intake_invitations")),
      ).rejects.toThrow();
      await expect(
        role(name, () =>
          db.query("select claim_intake_invitation($1,$2)", [
            client.id,
            "a".repeat(64),
          ]),
        ),
      ).rejects.toThrow();
      await expect(
        role(name, () =>
          db.query("select revoke_intake_invitation($1,$2)", [
            broker.id,
            randomUUID(),
          ]),
        ),
      ).rejects.toThrow();
      await expect(
        role(name, () =>
          db.query("select issue_intake_invitation($1,$2,$3)", [
            broker.id,
            "{}",
            "{}",
          ]),
        ),
      ).rejects.toThrow();
    }
    const i = issueInvitation(
      { ...broker, id: otherBroker },
      initial,
      "client@fictional.example",
    );
    await expect(
      role("service_role", () =>
        db.query("select issue_intake_invitation($1,$2,$3)", [
          otherBroker,
          JSON.stringify(initial),
          JSON.stringify(i.invitation),
        ]),
      ),
    ).rejects.toThrow("Access denied");
  });
  it("rejects wrong identity, unconfirmed email and a pre-existing other-organization membership without side effects", async () => {
    const i = await invite();
    await expect(claim(wrong, i.invitation.tokenHash)).rejects.toThrow(
      "identity",
    );
    const u = await invite("unconfirmed@fictional.example");
    await expect(claim(unconfirmed, u.invitation.tokenHash)).rejects.toThrow(
      "identity",
    );
    const c = await invite("crossorg@fictional.example");
    await expect(claim(crossOrgClient, c.invitation.tokenHash)).rejects.toThrow(
      "membership",
    );
    expect(
      (await db.query("select * from memberships where user_id=$1", [wrong]))
        .rows,
    ).toHaveLength(0);
    expect((await current()).assignedClientIds).toEqual([]);
    expect(
      (
        await db.query(
          "select claimed_at from intake_invitations where id=$1",
          [c.invitation.id],
        )
      ).rows[0],
    ).toEqual({ claimed_at: null });
  });
  it("enforces expiry and broker revocation in the database", async () => {
    const i = await invite();
    await db.query(
      "update intake_invitations set expires_at=now()-interval '1 second' where id=$1",
      [i.invitation.id],
    );
    await expect(claim(client.id, i.invitation.tokenHash)).rejects.toThrow(
      "Invalid invitation",
    );
    const r = await invite();
    await expect(
      role("service_role", () =>
        db.query("select revoke_intake_invitation($1,$2)", [
          otherBroker,
          r.invitation.id,
        ]),
      ),
    ).rejects.toThrow("Access denied");
    await role("service_role", () =>
      db.query("select revoke_intake_invitation($1,$2)", [
        broker.id,
        r.invitation.id,
      ]),
    );
    await expect(claim(client.id, r.invitation.tokenHash)).rejects.toThrow(
      "Invalid invitation",
    );
  });
  it("claims once, assigns only the invited business and invalidates its approval with preserved revision history", async () => {
    const i = await invite(),
      before = await current();
    await db.exec(`set request.jwt.claim.sub='${client.id}'`);
    expect(
      (
        await role("authenticated", () =>
          db.query("select * from client_businesses"),
        )
      ).rows,
    ).toHaveLength(0);
    await claim(client.id, i.invitation.tokenHash);
    const after = await current();
    expect(after.assignedClientIds).toEqual([client.id]);
    expect(after.revision).toBe(before.revision + 1);
    expect(after.approval).toBeUndefined();
    expect(after.draft).toBeUndefined();
    expect(
      (
        await db.query(
          "select role,organization_id from memberships where user_id=$1",
          [client.id],
        )
      ).rows[0],
    ).toEqual({ role: "client", organization_id: initial.organizationId });
    expect(
      (
        await role("authenticated", () =>
          db.query("select * from client_businesses"),
        )
      ).rows,
    ).toHaveLength(1);
    await expect(claim(client.id, i.invitation.tokenHash)).rejects.toThrow(
      "Invalid invitation",
    );
    await expect(
      role("service_role", () =>
        db.query("select revoke_intake_invitation($1,$2)", [
          broker.id,
          i.invitation.id,
        ]),
      ),
    ).rejects.toThrow("already claimed");
    expect(
      (await db.query("select * from business_revisions")).rows,
    ).toHaveLength(2);
    expect(
      (
        await db.query(
          "select state from business_revisions order by recorded_at limit 1",
        )
      ).rows[0],
    ).toEqual({ state: initial });
    const audit = JSON.stringify(
      (await db.query("select * from audit_events")).rows,
    );
    expect(audit).not.toContain(i.token);
    expect(audit).not.toContain(i.invitation.tokenHash);
  });
  it("rejects a stale broker save after a client save, even with equal caller-supplied revision intent", async () => {
    const before = await current(),
      clientEdit = saveIntakeResponse(
        client,
        before,
        "operations",
        "Fictional HVAC repair and maintenance only.",
        "answered",
      );
    await role("service_role", () =>
      db.query("select commit_business($1,$2,$3,$4,$5,$6)", [
        client.id,
        before.id,
        JSON.stringify(before),
        JSON.stringify(clientEdit),
        "save_response",
        "{}",
      ]),
    );
    const brokerEdit = saveIntakeResponse(
      broker,
      before,
      "operations",
      "A concurrent broker edit.",
      "answered",
    );
    await expect(
      role("service_role", () =>
        db.query("select commit_business($1,$2,$3,$4,$5,$6)", [
          broker.id,
          before.id,
          JSON.stringify(before),
          JSON.stringify(brokerEdit),
          "save_response",
          "{}",
        ]),
      ),
    ).rejects.toThrow("Stale");
    expect((await current()).answers.operations.value).toBe(
      clientEdit.answers.operations.value,
    );
    const latest = await current();
    await expect(
      role("service_role", () =>
        db.query("select commit_business($1,$2,$3,$4,$5,$6)", [
          client.id,
          latest.id,
          JSON.stringify(latest),
          JSON.stringify({ ...latest, revision: latest.revision + 1 }),
          "clarification_request",
          "{}",
        ]),
      ),
    ).rejects.toThrow("Broker required");
  });
});
