import "server-only";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { isDemo, serviceClient, sessionClient } from "./auth";
import { assertAccess, requireBroker, canonicalJSON } from "./domain";
import { sampleBusiness } from "./sample";
import { rulesFor } from "./rules";
import type { Actor, AuditEvent, BusinessState, Snapshot } from "./types";
// Demo is intentionally isolated and fictional; never a production persistence adapter.
const demoDirectory =
  process.env.DEMO_DATA_DIR || "/tmp/insurance-submissions-demo";
const demoPath = demoDirectory + "/state.json";
type DemoStore = {
  businesses: BusinessState[];
  audit: AuditEvent[];
  snapshots: Snapshot[];
  invitations?: import("./invitations").Invitation[];
};
const globalStore = globalThis as typeof globalThis & {
  insuranceQueue?: Promise<unknown>;
};
async function locked<T>(work: () => Promise<T>): Promise<T> {
  const pending = (globalStore.insuranceQueue ?? Promise.resolve()).then(
    work,
    work,
  );
  globalStore.insuranceQueue = pending.catch(() => {});
  return pending;
}
async function load(): Promise<DemoStore> {
  try {
    return JSON.parse(await readFile(demoPath, "utf8"));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    return { businesses: [sampleBusiness()], audit: [], snapshots: [] };
  }
}
async function persist(data: DemoStore) {
  await mkdir(demoDirectory, { recursive: true, mode: 0o700 });
  const path = demoPath + "." + randomUUID();
  await writeFile(path, JSON.stringify(data), { mode: 0o600 });
  await rename(path, demoPath);
}
function event(
  actor: Actor,
  state: BusinessState,
  action: string,
  detail: Record<string, unknown>,
): AuditEvent {
  return {
    id: randomUUID(),
    businessId: state.id,
    actorId: actor.id,
    actorName: actor.name,
    action,
    revision: state.revision,
    at: new Date().toISOString(),
    detail,
  };
}
export async function listBusinesses(actor: Actor): Promise<BusinessState[]> {
  if (isDemo()) {
    const data = await locked(load);
    return data.businesses.filter((s) => {
      try {
        assertAccess(actor, s);
        return true;
      } catch {
        return false;
      }
    });
  }
  const db = await sessionClient();
  const { data, error } = await db
    .from(actor.role === "client" ? "client_businesses" : "businesses")
    .select("state")
    .eq("organization_id", actor.organizationId)
    .order("created_at", { ascending: false });
  if (error) throw new Error("Unable to load business profiles");
  const states = (data ?? []).map((row) => row.state as BusinessState);
  if (states.length) {
    const versions = [...new Set(states.map((s) => s.rulesVersion))];
    const { data: published, error: ruleError } = await db
      .from("industry_rules")
      .select("version,rules")
      .in("version", versions);
    if (ruleError) throw new Error("Cannot validate published rule provenance");
    for (const state of states) {
      const version = published?.find(
        (rule) => rule.version === state.rulesVersion,
      );
      if (
        !version ||
        canonicalJSON(version.rules) !== canonicalJSON(rulesFor(state))
      )
        throw new Error(
          "Published rules do not match this application build. Review rule versions before continuing.",
        );
    }
  }
  return states;
}
export async function getBusiness(
  actor: Actor,
  id: string,
): Promise<BusinessState> {
  const s = (await listBusinesses(actor)).find((s) => s.id === id);
  if (!s) throw new Error("Business not found or access denied");
  assertAccess(actor, s);
  if (!isDemo() && actor.role === "client") {
    const { data, error } = await serviceClient()
      .from("businesses")
      .select("state")
      .eq("id", id)
      .eq("organization_id", actor.organizationId)
      .single();
    if (error || !data) throw new Error("Business unavailable");
    const full = data.state as BusinessState;
    assertAccess(actor, full);
    return full;
  }
  return s;
}
export async function createBusiness(actor: Actor, state: BusinessState) {
  requireBroker(actor);
  assertAccess(actor, state);
  if (isDemo())
    return locked(async () => {
      const db = await load();
      db.businesses.push(state);
      db.audit.push(event(actor, state, "business_created", {}));
      await persist(db);
    });
  const client = serviceClient();
  const definition = rulesFor(state);
  const { error: publishError } = await client.from("industry_rules").upsert(
    {
      version: state.rulesVersion,
      industry: state.rulesVersion.startsWith("ontario-commercial-")
        ? "commercial"
        : "contractors",
      provenance: "Common broker intake; not an insurer form",
      rules: definition,
    },
    { onConflict: "version", ignoreDuplicates: true },
  );
  if (publishError) throw new Error("Unable to publish versioned intake rules");
  const { data: published, error: readError } = await client
    .from("industry_rules")
    .select("rules")
    .eq("version", state.rulesVersion)
    .single();
  if (
    readError ||
    canonicalJSON(published?.rules) !== canonicalJSON(definition)
  )
    throw new Error("Published rule definition does not match this build");
  const { error } = await client.rpc("create_business", {
    p_actor_id: actor.id,
    p_state: state,
  });
  if (error) throw new Error("Business could not be created");
}
export async function commit(
  actor: Actor,
  before: BusinessState,
  after: BusinessState,
  action: string,
  detail: Record<string, unknown> = {},
) {
  assertAccess(actor, before);
  assertAccess(actor, after);
  if (isDemo())
    return locked(async () => {
      const db = await load();
      const i = db.businesses.findIndex((s) => s.id === before.id);
      if (i < 0 || JSON.stringify(db.businesses[i]) !== JSON.stringify(before))
        throw new Error(
          "Application changed in another session. Reload and retry.",
        );
      db.businesses[i] = after;
      db.audit.push(event(actor, after, action, detail));
      await persist(db);
    });
  const { error } = await serviceClient().rpc("commit_business", {
    p_actor_id: actor.id,
    p_business_id: before.id,
    p_expected_state: before,
    p_state: after,
    p_action: action,
    p_detail: detail,
  });
  if (error)
    throw new Error(
      "Application changed or update was denied. Reload and retry.",
    );
}
export async function auditFor(
  actor: Actor,
  state: BusinessState,
): Promise<AuditEvent[]> {
  assertAccess(actor, state);
  requireBroker(actor);
  if (isDemo())
    return locked(async () => {
      const db = await load();
      return db.audit
        .filter((e) => e.businessId === state.id)
        .reverse()
        .slice(0, 100);
    });
  const { data, error } = await (
    await sessionClient()
  )
    .from("audit_events")
    .select("event")
    .eq("business_id", state.id)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error("Unable to load audit log");
  return (data ?? []).map((row) => row.event as AuditEvent);
}
export async function recordSnapshot(
  actor: Actor,
  state: BusinessState,
  snapshot: Snapshot,
) {
  assertAccess(actor, state);
  requireBroker(actor);
  if (isDemo())
    return locked(async () => {
      const db = await load();
      const current = db.businesses.find((b) => b.id === state.id);
      if (JSON.stringify(current) !== JSON.stringify(state))
        throw new Error("Application changed. Approval must be rechecked.");
      db.snapshots.push(snapshot);
      db.audit.push(
        event(actor, state, "final_generated", {
          snapshotId: snapshot.id,
          approvalId: snapshot.approvalId,
          digest: snapshot.digest,
        }),
      );
      await persist(db);
    });
  const { error } = await serviceClient().rpc("record_snapshot", {
    p_actor_id: actor.id,
    p_business_id: state.id,
    p_expected_state: state,
    p_snapshot: snapshot,
  });
  if (error)
    throw new Error(
      "Unable to record final submission; reload and recheck approval",
    );
}
export async function recordDocumentAccess(
  actor: Actor,
  state: BusinessState,
  documentId: string,
) {
  if (isDemo())
    return locked(async () => {
      const db = await load();
      db.audit.push(
        event(actor, state, "document_download_requested", { documentId }),
      );
      await persist(db);
    });
  const { error } = await serviceClient().rpc("log_document_access", {
    p_actor_id: actor.id,
    p_business_id: state.id,
    p_document_id: documentId,
  });
  if (error) throw new Error("Unable to record document access");
}

export async function clientMembers(
  actor: Actor,
): Promise<{ id: string; label: string }[]> {
  requireBroker(actor);
  if (isDemo()) {
    const { DEMO_CLIENT } = await import("./sample");
    return [{ id: DEMO_CLIENT.id, label: DEMO_CLIENT.name }];
  }
  const { data, error } = await serviceClient()
    .from("memberships")
    .select("user_id")
    .eq("organization_id", actor.organizationId)
    .eq("role", "client");
  if (error) throw new Error("Unable to load client membership");
  return (data ?? []).map((m) => ({
    id: m.user_id,
    label: `Client ${m.user_id.slice(0, 8)}`,
  }));
}

export async function issuePrivateInvitation(
  actor: Actor,
  state: BusinessState,
  email: string,
  days: number,
) {
  const { issueInvitation } = await import("./invitations");
  const { token, invitation } = issueInvitation(actor, state, email, days);
  if (isDemo())
    await locked(async () => {
      const db = await load();
      const current = db.businesses.find((b) => b.id === state.id);
      if (canonicalJSON(current) !== canonicalJSON(state))
        throw new Error("Application changed; reload before inviting");
      (db.invitations ??= []).push(invitation);
      db.audit.push(
        event(actor, state, "invitation_created", {
          invitationId: invitation.id,
          expiresAt: invitation.expiresAt,
        }),
      );
      await persist(db);
    });
  else {
    const { error } = await serviceClient().rpc("issue_intake_invitation", {
      p_actor: actor.id,
      p_expected_state: state,
      p_invite: invitation,
    });
    if (error)
      throw new Error(
        "Invitation could not be created. Check workflow migration and reload.",
      );
  }
  return token;
}
export async function privateInvitations(actor: Actor, state: BusinessState) {
  assertAccess(actor, state);
  requireBroker(actor);
  if (isDemo())
    return ((await locked(load)).invitations ?? [])
      .filter((i) => i.businessId === state.id)
      .map(({ tokenHash, ...i }) => i);
  const { data, error } = await serviceClient()
    .from("intake_invitations")
    .select("id,email,expires_at,revoked_at,claimed_at")
    .eq("business_id", state.id)
    .eq("organization_id", actor.organizationId);
  if (error)
    throw new Error(
      "Apply the client workflow migration before using invitations",
    );
  return (data ?? []).map((i) => ({
    id: i.id,
    email: i.email,
    expiresAt: i.expires_at,
    revokedAt: i.revoked_at,
    claimedAt: i.claimed_at,
  }));
}
export async function revokePrivateInvitation(
  actor: Actor,
  state: BusinessState,
  id: string,
) {
  assertAccess(actor, state);
  requireBroker(actor);
  if (isDemo())
    return locked(async () => {
      const db = await load();
      const i = db.invitations?.find(
        (i) =>
          i.id === id &&
          i.businessId === state.id &&
          i.organizationId === actor.organizationId,
      );
      if (!i || i.claimedAt)
        throw new Error("Invitation unavailable or already claimed");
      i.revokedAt = new Date().toISOString();
      db.audit.push(
        event(actor, state, "invitation_revoked", { invitationId: id }),
      );
      await persist(db);
    });
  const { error } = await serviceClient().rpc("revoke_intake_invitation", {
    p_actor: actor.id,
    p_id: id,
  });
  if (error) throw new Error("Invitation unavailable or already claimed");
}
export async function claimPrivateInvitation(
  identity: import("./invitations").Identity,
  token: string,
) {
  const { invitationHash, validateInvitation } = await import("./invitations");
  const hash = invitationHash(token);
  if (isDemo())
    return locked(async () => {
      const { DEMO_CLIENT } = await import("./sample");
      const db = await load();
      const i = db.invitations?.find((i) => i.tokenHash === hash);
      validateInvitation(identity, i, token);
      if (
        identity.id !== DEMO_CLIENT.id ||
        i!.organizationId !== DEMO_CLIENT.organizationId
      )
        throw new Error("Existing membership cannot be changed");
      const s = db.businesses.find((b) => b.id === i!.businessId);
      if (!s) throw new Error("Application unavailable");
      const { changed } = await import("./domain");
      let next = s;
      if (!s.assignedClientIds.includes(identity.id)) {
        next = changed(s);
        next.assignedClientIds = [...s.assignedClientIds, identity.id];
        db.businesses[db.businesses.indexOf(s)] = next;
      }
      i!.claimedBy = identity.id;
      i!.claimedAt = new Date().toISOString();
      db.audit.push(
        event({ ...DEMO_CLIENT }, next, "invitation_claimed", {
          invitationId: i!.id,
        }),
      );
      await persist(db);
      return s.id;
    });
  if (!identity.verified) throw new Error("Verify your email before claiming");
  const { data, error } = await serviceClient().rpc("claim_intake_invitation", {
    p_actor: identity.id,
    p_token_hash: hash,
  });
  if (error)
    throw new Error(
      "Invitation is invalid, expired, already used, or does not match your verified email",
    );
  return data as string;
}
