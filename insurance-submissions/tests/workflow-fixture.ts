import {
  sampleBusiness,
  DEMO_BROKER as broker,
  DEMO_CLIENT as client,
} from "../src/lib/sample";
import { PREMARKET_RULE_VERSION } from "../src/lib/coverage-intake";
import {
  saveAnswer,
  verifyAnswer,
  attachDraft,
  approve,
} from "../src/lib/domain";
import { activeQuestions, coverageCodes, isVerified } from "../src/lib/rules";
import type { BusinessState } from "../src/lib/types";

export function pilot(): BusinessState {
  let s: BusinessState = {
    ...sampleBusiness(),
    rulesVersion: PREMARKET_RULE_VERSION,
    answers: {},
    profile: {
      ...sampleBusiness().profile,
      legalName: "Fictional HVAC Service Pilot Ltd.",
      description:
        "Ontario HVAC service and repair only; fictional workflow test.",
    },
  };
  for (const c of ["cgl", "property", "auto", "equipment", "professional"])
    s = saveAnswer(broker, s, "cover_" + c, c === "cgl" ? "yes" : "no");
  return s;
}
export function completePilot(): BusinessState {
  let s = pilot();
  for (const q of activeQuestions(s)) {
    if (s.answers[q.id]) continue;
    let value =
      q.type === "boolean"
        ? "no"
        : q.type === "number"
          ? "4"
          : "Fictional confirmed service and repair information.";
    if (q.id === "operations")
      value =
        "Fictional HVAC maintenance and repair in Ontario; no installation or design.";
    if (q.id === "revenue_split")
      value = "100% Ontario HVAC service and repair";
    if (q.id === "effective_date") value = "2026-12-01";
    if (q.id === "locations")
      value = JSON.stringify([
        {
          reference: "fictional-location-1",
          address: "123 Fictional Street, London, ON N6A 1A1",
          tenure: "leased",
          occupancy: "Fictional HVAC service office",
          leaseResponsibilities:
            "Tenant insures liability only; landlord insures the building.",
        },
      ]);
    if (q.id === "intake_attestation") value = "yes";
    s = saveAnswer(
      q.provenance.owner === "broker" ? broker : client,
      s,
      q.id,
      value,
    );
  }
  // Verify last, because changes to dependencies invalidate prior verification.
  for (const q of activeQuestions(s)) s = verifyAnswer(broker, s, q.id);
  return s;
}
export function approvedPilot(): BusinessState {
  let s = completePilot();
  s = attachDraft(
    broker,
    s,
    {
      overviewQuestionIds: activeQuestions(s)
        .filter((q) => isVerified(s, q.id))
        .map((q) => q.id),
      coverageCodes: coverageCodes(s),
      followUpQuestionIds: [],
    },
    "rules",
    "workflow-test",
  );
  return approve(broker, s);
}
