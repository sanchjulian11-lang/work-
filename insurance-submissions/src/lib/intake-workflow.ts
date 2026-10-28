import { randomUUID } from "node:crypto";
import { assertAccess, changed, requireBroker, saveAnswer } from "./domain";
import { activeQuestions, isVerified, completeness } from "./rules";
import { scheduleIssues } from "./coverage-intake";
import type { Actor, BusinessState, Answer } from "./types";
export type ResponseStatus = NonNullable<Answer["status"]>;
export function clientQuestions(s: BusinessState) {
  return activeQuestions(s).filter((q) => q.provenance.owner === "client");
}
function workflow(s: BusinessState) {
  return structuredClone(
    s.intake ?? { drafts: {}, submissions: [], requests: [] },
  );
}
export function clientGaps(s: BusinessState): string[] {
  const gaps: string[] = [];
  for (const q of clientQuestions(s)) {
    const draft = s.intake?.drafts[q.id],
      a = s.answers[q.id];
    if (draft)
      gaps.push(`${q.label}: saved draft needs correction (${draft.error})`);
    else if (a?.status === "unknown")
      gaps.push(`${q.label}: client does not know`);
    else if (a?.status === "unavailable")
      gaps.push(`${q.label}: not available yet`);
    else if (q.required && !a?.value.trim())
      gaps.push(`${q.label}: not provided`);
    else if (q.type === "schedule" && a?.value)
      gaps.push(
        ...scheduleIssues(q.id, a.value, q.scheduleFields ?? []).map(
          (x) => `${q.label}: ${x}`,
        ),
      );
  }
  // Reuse the existing checks for dates, percentage totals and cross-record
  // inconsistencies. Broker attestations are separate from the client's handoff;
  // typed unknowns, saved drafts and requests already have clearer entries above.
  const checks = completeness(s);
  gaps.push(
    ...checks.profileIssues.filter(
      (issue) =>
        !/^(Broker |Select at least |Market requirement|Unvalidated saved draft:|Resolve unknown or unavailable information:|Resolve clarification:)/.test(
          issue,
        ),
    ),
    ...checks.documentIssues.map(
      (issue) => `Broker document follow-up: ${issue}`,
    ),
  );
  for (const request of s.intake?.requests ?? [])
    if (!request.resolvedAt)
      gaps.push(
        `Broker clarification: ${request.prompt} (${request.respondedAt ? "awaiting broker review" : "awaiting your response"})`,
      );
  return [...new Set(gaps)];
}
export function saveIntakeResponse(
  actor: Actor,
  s: BusinessState,
  id: string,
  value: string,
  status: ResponseStatus,
): BusinessState {
  assertAccess(actor, s);
  if (!clientQuestions(s).some((q) => q.id === id))
    throw new Error("This is not an active client question");
  if (!["answered", "unknown", "unavailable"].includes(status))
    throw new Error("Invalid answer status");
  if (value.length > 100000) throw new Error("Draft is too long");
  try {
    return saveAnswer(actor, s, id, value, status);
  } catch (e) {
    // Persist invalid input separately; it can never become a verified statement.
    const next = changed(s);
    next.intake = workflow(s);
    if (s.answers[id]) {
      const { verifiedBy, verifiedAt, ...record } = s.answers[id];
      next.answers = { ...s.answers, [id]: record };
    }
    next.intake.drafts[id] = {
      value,
      status,
      error: e instanceof Error ? e.message : "Check this answer",
      recordedBy: actor.id,
      savedAt: new Date().toISOString(),
    };
    return next;
  }
}
export function submitIntake(
  actor: Actor,
  s: BusinessState,
  confirmed: boolean,
): BusinessState {
  assertAccess(actor, s);
  if (actor.role !== "client") throw new Error("Client submission required");
  if (!confirmed)
    throw new Error(
      "Confirm that you want to send your saved information to the broker",
    );
  const next = changed(s);
  next.intake = workflow(s);
  next.intake.submissions.push({
    id: randomUUID(),
    revision: next.revision,
    submittedBy: actor.id,
    submittedAt: new Date().toISOString(),
    gaps: clientGaps(s),
  });
  return next;
}
export function requestClarification(
  actor: Actor,
  s: BusinessState,
  id: string,
  prompt: string,
): BusinessState {
  assertAccess(actor, s);
  requireBroker(actor);
  if (!clientQuestions(s).some((q) => q.id === id))
    throw new Error("Choose an active client question");
  if (prompt.trim().length < 5 || prompt.length > 2000)
    throw new Error("Enter a question between 5 and 2000 characters");
  const next = changed(s);
  next.intake = workflow(s);
  next.intake.requests.push({
    id: randomUUID(),
    questionId: id,
    prompt: prompt.trim(),
    askedBy: actor.id,
    askedAt: new Date().toISOString(),
  });
  return next;
}
export function respondClarification(
  actor: Actor,
  s: BusinessState,
  id: string,
  response: string,
): BusinessState {
  assertAccess(actor, s);
  if (actor.role !== "client") throw new Error("Client response required");
  if (!response.trim() || response.length > 4000)
    throw new Error("Enter a response up to 4000 characters");
  const next = changed(s);
  next.intake = workflow(s);
  const request = next.intake.requests.find((r) => r.id === id);
  if (!request || request.resolvedAt) throw new Error("Open request not found");
  Object.assign(request, {
    response: response.trim(),
    respondedBy: actor.id,
    respondedAt: new Date().toISOString(),
  });
  return next;
}
export function resolveClarification(
  actor: Actor,
  s: BusinessState,
  id: string,
  resolution: string,
): BusinessState {
  assertAccess(actor, s);
  requireBroker(actor);
  const next = changed(s);
  next.intake = workflow(s);
  const request = next.intake.requests.find((r) => r.id === id);
  if (!request || request.resolvedAt) throw new Error("Open request not found");
  if (resolution.trim().length < 5 || resolution.length > 2000)
    throw new Error("Record how this request was resolved");
  Object.assign(request, {
    resolution: resolution.trim(),
    resolvedBy: actor.id,
    resolvedAt: new Date().toISOString(),
  });
  return next;
}
export function intakeStatus(s: BusinessState) {
  const last = s.intake?.submissions.at(-1);
  if (s.approval) return "Approved";
  if (s.intake?.requests.some((r) => !r.resolvedAt && !r.respondedAt))
    return "Changes requested";
  if (s.intake?.requests.some((r) => !r.resolvedAt && r.respondedAt))
    return "Client response to review";
  if (last)
    return s.revision > last.revision
      ? "Updated since submission"
      : "Submitted to broker";
  return "In progress";
}
export function intakeView(s: BusinessState) {
  const qs = clientQuestions(s);
  return {
    id: s.id,
    revision: s.revision,
    profile: s.profile,
    fictional: s.fictional,
    questions: qs,
    answers: Object.fromEntries(
      qs.map((q) => [q.id, s.answers[q.id]]).filter(([, v]) => !!v),
    ),
    drafts: Object.fromEntries(
      qs.map((q) => [q.id, s.intake?.drafts[q.id]]).filter(([, v]) => !!v),
    ),
    requests: s.intake?.requests ?? [],
    submissions: s.intake?.submissions ?? [],
    gaps: clientGaps(s),
    status: intakeStatus(s),
    documents: s.documents.map((d) => ({ id: d.id, name: d.name })),
    locations: s.answers.locations?.value,
    verifiedIds: qs.filter((q) => isVerified(s, q.id)).map((q) => q.id),
  };
}
export type IntakeView = ReturnType<typeof intakeView>;
