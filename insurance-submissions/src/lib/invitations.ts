import {
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { assertAccess, requireBroker } from "./domain";
import type { Actor, BusinessState } from "./types";
export type Identity = { id: string; email: string; verified: boolean };
export type Invitation = {
  id: string;
  businessId: string;
  organizationId: string;
  email: string;
  tokenHash: string;
  createdBy: string;
  createdAt: string;
  expiresAt: string;
  revokedAt?: string;
  claimedBy?: string;
  claimedAt?: string;
};
export function invitationHash(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token))
    throw new Error("Invitation is invalid, expired or already used");
  return createHash("sha256").update(token).digest("hex");
}
export function issueInvitation(
  actor: Actor,
  s: BusinessState,
  email: string,
  days = 7,
  now = Date.now(),
) {
  assertAccess(actor, s);
  requireBroker(actor);
  email = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)
    throw new Error("Enter a valid recipient email");
  if (!Number.isInteger(days) || days < 1 || days > 14)
    throw new Error("Use an expiry of 1 to 14 days");
  const token = randomBytes(32).toString("hex");
  const invitation: Invitation = {
    id: randomUUID(),
    businessId: s.id,
    organizationId: s.organizationId,
    email,
    tokenHash: invitationHash(token),
    createdBy: actor.id,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + days * 86400000).toISOString(),
  };
  return { token, invitation };
}
export function validateInvitation(
  identity: Identity,
  invite: Invitation | undefined,
  token: string,
  now = Date.now(),
) {
  const hash = invitationHash(token);
  if (
    !invite ||
    !timingSafeEqual(Buffer.from(hash), Buffer.from(invite.tokenHash)) ||
    invite.revokedAt ||
    invite.claimedAt ||
    !Number.isFinite(Date.parse(invite.expiresAt)) ||
    Date.parse(invite.expiresAt) <= now ||
    !identity.verified ||
    identity.email.trim().toLowerCase() !== invite.email
  )
    throw new Error(
      "Invitation is invalid, expired, already used, or does not match your verified email",
    );
}
