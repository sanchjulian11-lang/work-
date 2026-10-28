import { describe, it, expect } from "vitest";
import {
  issueInvitation,
  validateInvitation,
  invitationHash,
} from "../src/lib/invitations";
import {
  DEMO_BROKER as broker,
  DEMO_CLIENT as client,
} from "../src/lib/sample";
import { pilot } from "./workflow-fixture";
const now = Date.parse("2026-10-27T12:00:00Z");
const identity = {
  id: client.id,
  email: "client@fictional.example",
  verified: true,
};
describe("private invitations", () => {
  it("stores only a hash, normalizes recipient and creates unique 256-bit one-time secrets", () => {
    const a = issueInvitation(
      broker,
      pilot(),
      " CLIENT@fictional.example ",
      1,
      now,
    );
    const b = issueInvitation(
      broker,
      pilot(),
      "client@fictional.example",
      1,
      now,
    );
    expect(a.token).toMatch(/^[a-f0-9]{64}$/);
    expect(a.token).not.toBe(b.token);
    expect(JSON.stringify(a.invitation)).not.toContain(a.token);
    expect(a.invitation.tokenHash).toBe(invitationHash(a.token));
    expect(a.invitation.email).toBe(identity.email);
    expect(() =>
      validateInvitation(identity, a.invitation, a.token, now),
    ).not.toThrow();
  });
  it("rejects expired, revoked, used, wrong-email, unconfirmed and malformed claims", () => {
    const { token, invitation: i } = issueInvitation(
      broker,
      pilot(),
      identity.email,
      1,
      now,
    );
    for (const invite of [
      undefined,
      { ...i, revokedAt: new Date(now).toISOString() },
      { ...i, claimedAt: new Date(now).toISOString() },
      { ...i, expiresAt: new Date(now).toISOString() },
    ])
      expect(() => validateInvitation(identity, invite, token, now)).toThrow();
    for (const who of [
      { ...identity, email: "wrong@fictional.example" },
      { ...identity, verified: false },
    ])
      expect(() => validateInvitation(who, i, token, now)).toThrow();
    for (const bad of ["", "arbitrary-token", "a".repeat(64)])
      expect(() => validateInvitation(identity, i, bad, now)).toThrow();
    expect(() =>
      validateInvitation(identity, i, token, now + 86400000),
    ).toThrow();
  });
  it("allows only authorized brokers and bounded recipient/expiry inputs", () => {
    expect(() => issueInvitation(client, pilot(), identity.email)).toThrow(
      "Broker",
    );
    expect(() =>
      issueInvitation(
        { ...broker, organizationId: "another-org" },
        pilot(),
        identity.email,
      ),
    ).toThrow("Access denied");
    for (const days of [0, 15, 1.5, NaN])
      expect(() =>
        issueInvitation(broker, pilot(), identity.email, days),
      ).toThrow("expiry");
    expect(() => issueInvitation(broker, pilot(), "not an email")).toThrow(
      "email",
    );
  });
});
