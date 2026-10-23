import {
  LATEST_RULE_VERSION,
  displayAnswer,
  scheduleIssues,
} from "./coverage-intake";
import { scheduleRows } from "./coverage-intake";
import { locationOptions } from "./location-options";
import { createHash, randomUUID } from "node:crypto";
import {
  activeQuestions,
  completeness,
  isVerified,
  coverageCodes,
  COVERAGES,
  validateAnswer,
} from "./rules";
import type { Actor, AIPlan, BusinessState, Snapshot } from "./types";
export function assertAccess(actor: Actor, s: BusinessState) {
  if (
    actor.organizationId !== s.organizationId ||
    (actor.role === "client" && !s.assignedClientIds.includes(actor.id))
  )
    throw new Error("Access denied");
}
export function requireBroker(actor: Actor) {
  if (!["broker", "admin"].includes(actor.role))
    throw new Error("Broker role required");
}
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, canonical(v)]),
    );
  return value;
}
export function canonicalJSON(value: unknown): string {
  return JSON.stringify(canonical(value));
}
export function fingerprint(s: BusinessState): string {
  const { approval: _, ...body } = s;
  return createHash("sha256").update(canonicalJSON(body)).digest("hex");
}
export function changed(s: BusinessState): BusinessState {
  return {
    ...s,
    revision: s.revision + 1,
    draft: undefined,
    approval: undefined,
  };
}
export function saveAnswer(
  actor: Actor,
  s: BusinessState,
  id: string,
  value: string,
): BusinessState {
  assertAccess(actor, s);
  if (rulesFor(s).find((q) => q.id === id)?.provenance.owner === "broker")
    requireBroker(actor);
  if (id === "locations" && value.trim())
    value = JSON.stringify(
      scheduleRows(value).map((r) =>
        r.reference?.trim() ? r : { ...r, reference: randomUUID() },
      ),
    );
  validateAnswer(s, id, value);
  const next = changed(s);
  next.answers = { ...s.answers };
  if (!value.trim()) delete next.answers[id];
  else
    next.answers[id] = {
      value: value.trim(),
      source: actor.role === "client" ? "client_statement" : "broker_recorded",
      recordedBy: actor.id,
      recordedAt: new Date().toISOString(),
      questionVersion: s.rulesVersion,
    };
  // Parent changes revoke dependent verification, including currently hidden descendants.
  const revoke = (parent: string) => {
    for (const q of activeOrAll(s))
      if (
        (q.when?.id === parent ||
          q.conditions?.some((c) => c.id === parent) ||
          q.dependsOn?.includes(parent)) &&
        next.answers[q.id]
      ) {
        const { verifiedBy: _, verifiedAt: __, ...answer } = next.answers[q.id];
        next.answers[q.id] = answer;
        revoke(q.id);
      }
  };
  revoke(id);
  return next;
}
import { rulesFor } from "./rules";
function activeOrAll(s: BusinessState) {
  return rulesFor(s);
}
export function verifyAnswer(
  actor: Actor,
  s: BusinessState,
  id: string,
): BusinessState {
  assertAccess(actor, s);
  requireBroker(actor);
  const answer = s.answers[id];
  if (!answer?.value.trim() || !activeQuestions(s).some((q) => q.id === id))
    throw new Error("An active recorded answer is required");
  validateAnswer(s, id, answer.value);
  const problems = scheduleIssues(id, answer.value);
  if (problems.length) throw new Error(problems.slice(0, 3).join(" "));
  const next = changed(s);
  next.answers = {
    ...s.answers,
    [id]: {
      ...answer,
      verifiedBy: actor.id,
      verifiedAt: new Date().toISOString(),
      questionVersion: s.rulesVersion,
    },
  };
  return next;
}
export function validatePlan(s: BusinessState, plan: AIPlan): AIPlan {
  const active = activeQuestions(s);
  const verified = active.filter((q) => isVerified(s, q.id)).map((q) => q.id);
  const allowedCoverage = coverageCodes(s);
  if (
    plan.overviewQuestionIds.some((id) => !verified.includes(id)) ||
    plan.coverageCodes.some((id) => !allowedCoverage.includes(id)) ||
    plan.followUpQuestionIds.some(
      (id) => !active.some((q) => q.id === id) || !!s.answers[id]?.verifiedBy,
    )
  )
    throw new Error("AI returned unsupported references");
  return {
    overviewQuestionIds: [...new Set(plan.overviewQuestionIds)],
    coverageCodes: [...new Set(plan.coverageCodes)],
    followUpQuestionIds: [...new Set(plan.followUpQuestionIds)],
  };
}
export function attachDraft(
  actor: Actor,
  s: BusinessState,
  plan: AIPlan,
  mode: "ai" | "rules",
  model: string,
): BusinessState {
  assertAccess(actor, s);
  requireBroker(actor);
  const valid = validatePlan(s, plan);
  const next = changed(s);
  next.draft = {
    id: randomUUID(),
    revision: next.revision,
    mode,
    model,
    generatedAt: new Date().toISOString(),
    plan: valid,
  };
  return next;
}
export function approve(actor: Actor, s: BusinessState): BusinessState {
  assertAccess(actor, s);
  requireBroker(actor);
  if (!completeness(s).ready)
    throw new Error(
      "Resolve missing answers, verification, and document reviews first",
    );
  if (!s.draft || s.draft.revision !== s.revision)
    throw new Error("Generate and review a current draft first");
  return {
    ...s,
    approval: {
      id: randomUUID(),
      revision: s.revision,
      draftId: s.draft.id,
      brokerId: actor.id,
      brokerName: actor.name,
      approvedAt: new Date().toISOString(),
      digest: fingerprint(s),
    },
  };
}
export function finalSubmission(actor: Actor, s: BusinessState): Snapshot {
  assertAccess(actor, s);
  requireBroker(actor);
  if (
    !s.approval ||
    s.approval.revision !== s.revision ||
    s.approval.digest !== fingerprint(s) ||
    !completeness(s).ready
  )
    throw new Error("Current broker approval required");
  return {
    id: randomUUID(),
    businessId: s.id,
    approvalId: s.approval.id,
    revision: s.revision,
    generatedAt: new Date().toISOString(),
    digest: s.approval.digest,
    content: renderSubmission(s, true),
  };
}
function mdText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/[\\`*_{}\[\]()#+!|]/g, "\\$&")
    .replace(/\r?\n/g, " ");
}
export function renderSubmission(s: BusinessState, final = false): string {
  const questions = activeQuestions(s);
  const ordered = s.draft?.plan.overviewQuestionIds ?? [];
  const facts = [...questions]
    .sort((a, b) => {
      const x = ordered.indexOf(a.id),
        y = ordered.indexOf(b.id);
      return (x < 0 ? 999 : x) - (y < 0 ? 999 : y);
    })
    .filter((q) => isVerified(s, q.id));
  const lines = [
    final ? "# Broker-approved submission" : "# Internal submission draft",
    `Business: ${mdText(s.profile.legalName)}`,
    `Operating name: ${mdText(s.profile.operatingName || "Not provided")}`,
    `Location: ${mdText(s.profile.city)}, ${s.profile.province}`,
    `Industry: ${s.profile.industry}`,
    `Rules: ${s.rulesVersion} · Revision: ${s.revision}`,
    s.fictional ? "FICTIONAL ACCOUNT — NOT FOR REAL PLACEMENT" : "",
    "",
    ...(s.answers.market_status
      ? [`Submission scope: ${mdText(s.answers.market_status.value)}`, ""]
      : []),
    "## Recorded statements verified by broker",
    "Verification means broker-reviewed recorded statements, not independent proof.",
  ];
  for (const q of facts) {
    const a = s.answers[q.id];
    lines.push(
      `- ${q.label}: ${mdText(displayAnswer(q.id, a.value, s.documents, locationOptions(s.answers.locations?.value)))}`,
      `  Source: ${a.source}; recorded ${a.recordedAt}; verified ${a.verifiedAt}; question ${q.provenance.reference} @ ${a.questionVersion}`,
    );
  }
  lines.push(
    "",
    "## Coverage considerations — inferences, not coverage determinations",
  );
  for (const code of s.draft?.plan.coverageCodes ?? []) {
    const c = COVERAGES[code as keyof typeof COVERAGES];
    lines.push(
      `- ${c.label}: ${c.rationale} Evidence references: ${c.evidence.join(", ")}. Subject to policy wording, terms, and insurer review.`,
    );
  }
  if (!final) {
    lines.push("", "## Outstanding / not verified");
    for (const q of questions.filter((q) => !isVerified(s, q.id)))
      lines.push(
        `- ${q.label}: ${s.answers[q.id]?.value ? "Recorded but unverified" : "Not provided"}`,
      );
  }
  lines.push("", "## Documents");
  for (const d of s.documents)
    lines.push(
      `- ${mdText(d.name)} (${d.kind}); SHA-256 ${d.sha256}; broker reviewed ${d.reviewedAt ?? "pending"}`,
    );
  if (s.approval)
    lines.push(
      "",
      `Approved by ${mdText(s.approval.brokerName)} at ${s.approval.approvedAt}; approval ${s.approval.id}.`,
    );
  lines.push(
    "",
    "Prepared for manual broker handling. No binding authority or market acceptance is implied.",
  );
  return lines.filter((line) => line !== undefined).join("\n");
}

export function updatedIntakeCopy(
  actor: Actor,
  s: BusinessState,
): BusinessState {
  assertAccess(actor, s);
  requireBroker(actor);
  if (s.rulesVersion === LATEST_RULE_VERSION)
    throw new Error("This application already uses the current rules.");
  return {
    id: randomUUID(),
    organizationId: s.organizationId,
    assignedClientIds: [],
    revision: 1,
    rulesVersion: LATEST_RULE_VERSION,
    fictional: s.fictional,
    profile: { ...s.profile },
    answers: Object.fromEntries(
      Object.entries(s.answers).map(([id, a]) => {
        const { verifiedBy, verifiedAt, ...record } = a;
        return [id, record];
      }),
    ),
    documents: [],
    copiedFrom: {
      businessId: s.id,
      revision: s.revision,
      rulesVersion: s.rulesVersion,
    },
  };
}
