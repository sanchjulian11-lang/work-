import {
  COVERAGE_RULE_VERSION,
  LATEST_RULE_VERSION,
  coverageLed,
  coverageRules,
  intakeIssues,
  scheduleIssues,
  scheduleRows,
  answerQualityText,
} from "./coverage-intake";
import type { BusinessState, Rule } from "./types";
export const RULE_VERSION = "ontario-contractors-2026.10.22-v1";
// Internal starter rules, not insurer-approved forms or a statement of market appetite.
const provenance = {
  source: "Internal contractor intake specification",
  reference: "UW-CONTRACTORS-001",
  version: RULE_VERSION,
  owner: "client" as const,
};
const q = (
  id: string,
  label: string,
  section: string,
  type: Rule["type"],
  extra: Partial<Rule> = {},
): Rule => ({
  id,
  label,
  section,
  type,
  required: true,
  provenance: { ...provenance, reference: `UW-CONTRACTORS-001/${id}` },
  ...extra,
});
export const CONTRACTOR_RULES: Rule[] = [
  q(
    "operations",
    "Describe all operations, services, and work performed",
    "Business",
    "text",
  ),
  q(
    "business_address",
    "Full legal business address and all operating locations",
    "Business",
    "text",
  ),
  q("ownership", "Ownership structure and principal names", "Business", "text"),
  q("years", "Years operating", "Business", "number", { min: 0, max: 150 }),
  q(
    "territory",
    "Work territories, including any work outside Ontario",
    "Business",
    "text",
  ),
  q(
    "experience",
    "Principal experience and applicable trade licences",
    "Business",
    "text",
  ),
  q("revenue", "Estimated annual gross revenue (CAD)", "Financial", "number", {
    min: 0,
    max: 10000000000,
  }),
  q(
    "revenue_split",
    "Revenue breakdown by operation and residential/commercial work (must total 100%)",
    "Financial",
    "text",
  ),
  q("payroll", "Estimated annual payroll (CAD)", "Financial", "number", {
    min: 0,
    max: 10000000000,
  }),
  q("employees", "Number of employees", "Financial", "number", {
    min: 0,
    max: 100000,
  }),
  q("subcontractors", "Do you use subcontractors?", "Operations", "boolean"),
  q(
    "subcontract_cost",
    "Annual subcontractor costs (CAD)",
    "Operations",
    "number",
    { min: 0, when: { id: "subcontractors", equals: "yes" } },
  ),
  q(
    "subcontract_controls",
    "Describe written contracts, certificates of insurance, and subcontractor controls",
    "Operations",
    "text",
    { when: { id: "subcontractors", equals: "yes" } },
  ),
  q(
    "hot_work",
    "Do you perform welding, brazing, torch work, or other hot work?",
    "Operations",
    "boolean",
  ),
  q(
    "hot_work_controls",
    "Describe hot-work frequency, locations, permits, fire watch, and fire protection",
    "Operations",
    "text",
    { when: { id: "hot_work", equals: "yes" } },
  ),
  q(
    "design",
    "Do you provide design, specifications, or professional advice?",
    "Operations",
    "boolean",
  ),
  q(
    "design_details",
    "Describe design responsibility, qualifications, and contracts",
    "Operations",
    "text",
    { when: { id: "design", equals: "yes" } },
  ),
  q("demolition", "Do you perform demolition?", "Operations", "boolean"),
  q(
    "demolition_details",
    "Describe structural demolition, percent of operations, and hazardous material controls",
    "Operations",
    "text",
    { when: { id: "demolition", equals: "yes" } },
  ),
  q(
    "refrigerants",
    "Do you handle refrigerants or other potentially polluting materials?",
    "Trade specifics",
    "boolean",
    { industries: ["hvac", "plumbing", "general"] },
  ),
  q(
    "refrigerant_controls",
    "Describe refrigerant/material storage, transport, handling, and disposal",
    "Trade specifics",
    "text",
    {
      when: { id: "refrigerants", equals: "yes" },
      industries: ["hvac", "plumbing", "general"],
    },
  ),
  q(
    "electrical_scope",
    "Describe voltage range, industrial work, and energized-work procedures",
    "Trade specifics",
    "text",
    { industries: ["electrical"] },
  ),
  q(
    "plumbing_scope",
    "Describe water damage prevention, testing, and any sprinkler work",
    "Trade specifics",
    "text",
    { industries: ["plumbing"] },
  ),
  q(
    "vehicles",
    "Are business vehicles used, owned, or leased?",
    "Assets",
    "boolean",
  ),
  q(
    "vehicle_details",
    "Vehicle schedule, ownership, use, radius, and driver information",
    "Assets",
    "text",
    { when: { id: "vehicles", equals: "yes" } },
  ),
  q(
    "equipment_value",
    "Tools and equipment replacement value (CAD)",
    "Assets",
    "number",
    { min: 0 },
  ),
  q(
    "equipment_storage",
    "Describe tools/equipment storage, transport, and theft controls",
    "Assets",
    "text",
  ),
  q(
    "premises",
    "Describe all premises, occupancy, construction, protection, and contents values",
    "Assets",
    "text",
  ),
  q(
    "current_insurance",
    "Current insurer, policy expiry, limits and deductibles; state none if uninsured",
    "Insurance history",
    "text",
  ),
  q(
    "claims",
    "Any claims, losses, or incidents in the past five years?",
    "Insurance history",
    "boolean",
  ),
  q(
    "claims_details",
    "Provide dates, descriptions, amounts, status, and corrective actions for every loss",
    "Insurance history",
    "text",
    { when: { id: "claims", equals: "yes" } },
  ),
  q(
    "coverage_request",
    "Requested coverages, limits, effective date, and contractual requirements",
    "Insurance history",
    "text",
  ),
];
export const RULESETS: Record<string, Rule[]> = {
  [RULE_VERSION]: CONTRACTOR_RULES,
  [COVERAGE_RULE_VERSION]: coverageRules(CONTRACTOR_RULES),
  [LATEST_RULE_VERSION]: coverageRules(CONTRACTOR_RULES, LATEST_RULE_VERSION),
};
export function rulesFor(s: BusinessState): Rule[] {
  const rules = RULESETS[s.rulesVersion];
  if (!rules)
    throw new Error("Unsupported rules version; broker review required");
  return rules;
}
export function activeQuestions(s: BusinessState): Rule[] {
  const rules = rulesFor(s);
  const matches = (c: { id: string; equals: string }) =>
    c.id === "equipment_shortfall"
      ? Number(s.answers.equipment_limit?.value) <
          Number(s.answers.equipment_value?.value) ===
        (c.equals === "yes")
      : s.answers[c.id]?.value === c.equals;
  const active = (r: Rule): boolean =>
    (!r.industries || r.industries.includes(s.profile.industry)) &&
    (!r.when ||
      (matches(r.when) &&
        !!rules.find((p) => p.id === r.when!.id && active(p)))) &&
    (!r.conditions || r.conditions.every(matches));
  return rules.filter(active);
}
export const COVERAGES = {
  cgl: {
    label: "Commercial general liability / completed operations",
    rationale:
      "Contracting operations require broker review of liability and completed-operations exposures.",
    evidence: ["operations"],
  },
  equipment: {
    label: "Contractors equipment",
    rationale: "Review equipment values, storage, and applicable terms.",
    evidence: ["equipment_value", "equipment_storage"],
  },
  auto: {
    label: "Commercial automobile",
    rationale:
      "Business vehicle use warrants a broker review of vehicle and driver exposures.",
    evidence: ["vehicles", "vehicle_details"],
  },
  professional: {
    label: "Contractors professional liability",
    rationale:
      "Design responsibility warrants review of professional exposures.",
    evidence: ["design", "design_details"],
  },
  property: {
    label: "Commercial property / business interruption",
    rationale:
      "Ownership, tenancy and property values require review of requested building, contents, improvements and interruption coverage.",
    evidence: ["locations", "property_schedule"],
  },
  pollution: {
    label: "Pollution liability",
    rationale: "Material handling warrants review of environmental exposures.",
    evidence: ["refrigerants", "refrigerant_controls"],
  },
} as const;
export function coverageCodes(s: BusinessState): string[] {
  const result = ["cgl"];
  if (Number(s.answers.equipment_value?.value) > 0) result.push("equipment");
  if (
    (s.answers.vehicles?.value === "yes" &&
      (s.rulesVersion !== LATEST_RULE_VERSION ||
        s.answers.cover_auto?.value === "yes")) ||
    s.answers.cover_auto?.value === "yes"
  )
    result.push("auto");
  if (
    coverageLed(s.rulesVersion) &&
    (s.answers.cover_property?.value === "yes" ||
      (() => {
        try {
          return scheduleRows(s.answers.locations?.value || "[]").some(
            (r) => r.tenure === "owned" || r.tenure === "leased",
          );
        } catch {
          return false;
        }
      })())
  )
    result.push("property");
  if (
    s.answers.design?.value === "yes" ||
    s.answers.cover_professional?.value === "yes"
  )
    result.push("professional");
  if (
    s.answers.refrigerants?.value === "yes" &&
    activeQuestions(s).some((q) => q.id === "refrigerants")
  )
    result.push("pollution");
  return result;
}
export function isVerified(s: BusinessState, id: string): boolean {
  const a = s.answers[id];
  return Boolean(
    a?.verifiedBy && a.verifiedAt && a.questionVersion === s.rulesVersion,
  );
}
export function completeness(s: BusinessState) {
  const active = activeQuestions(s);
  const missing = active
    .filter((q) => q.required && !s.answers[q.id]?.value.trim())
    .map((q) => q.id);
  const unverified = active
    .filter(
      (q) =>
        q.required && !!s.answers[q.id]?.value.trim() && !isVerified(s, q.id),
    )
    .map((q) => q.id);
  const documentIssues: string[] = [];
  if (
    s.answers.claims?.value === "yes" &&
    !s.documents.some((d) => d.kind === "loss_runs" && d.reviewedBy)
  )
    documentIssues.push(
      "A broker-reviewed loss record is required when losses are reported.",
    );
  for (const d of s.documents)
    if (!d.reviewedBy) documentIssues.push(`Review document: ${d.name}`);
  const profileIssues: string[] = intakeIssues(s);
  for (const q of active)
    if (q.type === "schedule" && s.answers[q.id]?.value)
      profileIssues.push(
        ...scheduleIssues(
          q.id,
          s.answers[q.id].value,
          q.scheduleFields ?? [],
        ).map((issue) => `${q.label}: ${issue}`),
      );
  for (const q of active) {
    const raw = s.answers[q.id]?.value;
    const value = raw
      ? answerQualityText(q.id, raw, q.scheduleFields ?? [])
      : raw;
    if (
      coverageLed(s.rulesVersion) &&
      value &&
      /\b(?:unknown|outstanding|tbd|to be supplied)\b/i.test(value)
    )
      profileIssues.push(`Unresolved information: ${q.label}`);
    if (
      value &&
      /\b(?:pending|not\s+(?:yet\s+)?(?:been\s+)?(?:supplied|provided|confirmed))\b/i.test(
        value,
      )
    )
      profileIssues.push(`Resolve incomplete statement: ${q.label}`);
  }
  const split = s.answers.revenue_split?.value;
  if (split) {
    const percentages = [...split.matchAll(/(\d+(?:\.\d+)?)\s*%/g)].map((m) =>
      Number(m[1]),
    );
    if (
      !percentages.length ||
      Math.abs(percentages.reduce((a, b) => a + b, 0) - 100) > 0.01
    )
      profileIssues.push("Revenue breakdown percentages must total 100%.");
  }

  if (!s.profile.legalName.trim()) profileIssues.push("Legal name is missing.");
  if (!s.profile.city.trim())
    profileIssues.push("Ontario business location is missing.");
  return {
    missing,
    unverified,
    documentIssues,
    profileIssues,
    ready:
      !missing.length &&
      !unverified.length &&
      !documentIssues.length &&
      !profileIssues.length,
    answered: active.filter((q) => s.answers[q.id]?.value.trim()).length,
    total: active.length,
  };
}
export function validateAnswer(
  s: BusinessState,
  id: string,
  value: string,
): void {
  const question = activeQuestions(s).find((q) => q.id === id);
  if (!question) throw new Error("Question is not active for this application");
  if (value.length > (question.type === "schedule" ? 100000 : 6000))
    throw new Error("Answer is too long");
  if (!value.trim()) return;
  if (question.type === "schedule") scheduleRows(value);
  if (question.type === "boolean" && !["yes", "no"].includes(value))
    throw new Error("Choose yes or no");
  if (question.type === "select" && !question.options?.includes(value))
    throw new Error("Invalid choice");
  if (question.type === "number") {
    const n = Number(value);
    if (
      !Number.isFinite(n) ||
      n < (question.min ?? 0) ||
      n > (question.max ?? 10000000000)
    )
      throw new Error("Number is outside the permitted range");
    if (["employees", "years"].includes(id) && !Number.isInteger(n))
      throw new Error("Use a whole number");
  }
}
