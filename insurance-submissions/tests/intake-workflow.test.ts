import { describe, it, expect } from "vitest";
import { pilot, completePilot, approvedPilot } from "./workflow-fixture";
import {
  DEMO_BROKER as broker,
  DEMO_CLIENT as client,
} from "../src/lib/sample";
import {
  saveIntakeResponse,
  submitIntake,
  requestClarification,
  respondClarification,
  resolveClarification,
  clientGaps,
  intakeView,
  intakeStatus,
} from "../src/lib/intake-workflow";
import {
  activeQuestions,
  completeness,
  isVerified,
  RULESETS,
} from "../src/lib/rules";
import { verifyAnswer, finalSubmission, fingerprint } from "../src/lib/domain";

describe("private client intake domain", () => {
  it("includes the existing date, percentage and narrative quality checks in the submitted gap receipt", () => {
    let s = completePilot();
    s = saveIntakeResponse(
      client,
      s,
      "effective_date",
      "2026-02-30",
      "answered",
    );
    s = saveIntakeResponse(
      client,
      s,
      "revenue_split",
      "60% service; 20% repairs",
      "answered",
    );
    s = saveIntakeResponse(
      client,
      s,
      "current_insurance",
      "Policy details have not been supplied.",
      "answered",
    );
    const gaps = submitIntake(client, s, true).intake!.submissions[0].gaps.join(
      "\n",
    );
    expect(gaps).toContain("valid YYYY-MM-DD date");
    expect(gaps).toContain("percentages must total 100%");
    expect(gaps).toContain("Resolve incomplete statement");
    expect(gaps).not.toContain("Broker intake review must be confirmed");
  });
  it("uses the existing pinned questionnaire and hides full auto/property/E&O schedules for CGL only", () => {
    const s = pilot(),
      before = JSON.stringify(RULESETS);
    const ids = activeQuestions(s).map((q) => q.id);
    for (const id of [
      "vehicles",
      "vehicle_schedule",
      "driver_schedule",
      "property_schedule",
      "professional_request",
    ])
      expect(ids).not.toContain(id);
    expect(ids).toContain("cgl_operations");
    saveIntakeResponse(
      client,
      s,
      "operations",
      "Fictional HVAC service and repair.",
      "answered",
    );
    expect(JSON.stringify(RULESETS)).toBe(before);
  });
  it("round-trips typed unknowns without inventing answers; unknowns block final review, not handoff", () => {
    let s = saveIntakeResponse(client, pilot(), "revenue", "", "unknown");
    s = saveIntakeResponse(client, s, "current_insurance", "", "unavailable");
    expect(intakeView(s).answers.revenue.status).toBe("unknown");
    expect(clientGaps(s).join("\n")).toContain("client does not know");
    expect(clientGaps(s).join("\n")).toContain("not available yet");
    expect(completeness(s).missing).toContain("revenue");
    expect(() => verifyAnswer(broker, s, "revenue")).toThrow();
    const submitted = submitIntake(client, s, true);
    expect(submitted.intake!.submissions[0].revision).toBe(submitted.revision);
    expect(submitted.intake!.submissions[0].gaps).toEqual(clientGaps(s));
    expect(intakeStatus(submitted)).toBe("Submitted to broker");
    const edited = saveIntakeResponse(
      client,
      submitted,
      "revenue",
      "100000",
      "answered",
    );
    expect(intakeStatus(edited)).toBe("Updated since submission");
    expect(submitted.intake!.submissions[0].gaps.join("\n")).toContain(
      "client does not know",
    );
  });
  it("persists invalid numeric drafts separately and prevents verification of the older recorded answer", () => {
    const original = completePilot();
    const s = saveIntakeResponse(
      client,
      original,
      "revenue",
      "-45",
      "answered",
    );
    expect(s.answers.revenue.value).toBe(original.answers.revenue.value);
    expect(s.intake!.drafts.revenue.value).toBe("-45");
    expect(s.answers.revenue.verifiedBy).toBeUndefined();
    expect(isVerified(s, "revenue")).toBe(false);
    expect(() => verifyAnswer(broker, s, "revenue")).toThrow("saved draft");
    expect(completeness(s).profileIssues.join("\n")).toContain(
      "Unvalidated saved draft",
    );
    const fixed = saveIntakeResponse(
      client,
      s,
      "revenue",
      "120000",
      "answered",
    );
    expect(fixed.intake!.drafts.revenue).toBeUndefined();
    expect(fixed.answers.revenue.source).toBe("client_statement");
    expect(original.answers.revenue.verifiedBy).toBe(broker.id);
  });
  it("keeps partial schedules durable and reports missing fields before final approval", () => {
    const s = saveIntakeResponse(
      client,
      pilot(),
      "locations",
      JSON.stringify([{ address: "123 Fictional Street, London" }]),
      "answered",
    );
    expect(JSON.parse(s.answers.locations.value)[0].reference).toBeTruthy();
    expect(clientGaps(s).some((g) => g.includes("Tenure is required"))).toBe(
      true,
    );
    expect(() => verifyAnswer(broker, s, "locations")).toThrow();
    expect(submitIntake(client, s, true).intake!.submissions).toHaveLength(1);
  });
  it("requires assignment, organization, active client-owned questions and explicit handoff confirmation", () => {
    const s = pilot();
    for (const actor of [
      { ...client, id: "unassigned" },
      { ...client, organizationId: "another-org" },
      { ...broker, organizationId: "another-org" },
    ]) {
      expect(() =>
        saveIntakeResponse(
          actor,
          s,
          "operations",
          "Other tenant data",
          "answered",
        ),
      ).toThrow("Access denied");
      expect(() => submitIntake(actor, s, true)).toThrow();
    }
    for (const id of [
      "cover_auto",
      "intake_attestation",
      "vehicle_schedule",
      "nonexistent",
    ])
      expect(() =>
        saveIntakeResponse(client, s, id, "yes", "answered"),
      ).toThrow("active client question");
    expect(() => submitIntake(client, s, false)).toThrow("Confirm");
    expect(() => submitIntake(broker, s, true)).toThrow("Client submission");
  });
  it("links clarification, response and resolution to a question; none substitutes for verified facts", () => {
    const original = completePilot();
    let s = requestClarification(
      broker,
      original,
      "operations",
      "Please confirm whether work includes installations.",
    );
    const id = s.intake!.requests[0].id;
    expect(completeness(s).ready).toBe(false);
    expect(intakeStatus(s)).toBe("Changes requested");
    expect(clientGaps(s).join("\n")).toContain("awaiting your response");
    s = respondClarification(
      client,
      s,
      id,
      "Service and repair only. No installations.",
    );
    expect(intakeStatus(s)).toBe("Client response to review");
    expect(clientGaps(s).join("\n")).toContain("awaiting broker review");
    expect(s.answers.operations).toEqual(original.answers.operations);
    expect(completeness(s).ready).toBe(false);
    s = resolveClarification(
      broker,
      s,
      id,
      "Reviewed response against recorded service-only operations.",
    );
    expect(completeness(s).ready).toBe(true);
    expect(s.intake!.requests[0]).toMatchObject({
      questionId: "operations",
      respondedBy: client.id,
      resolvedBy: broker.id,
    });
    expect(() => respondClarification(client, s, id, "Another reply")).toThrow(
      "Open request",
    );
    expect(() => resolveClarification(client, s, id, "Resolved")).toThrow(
      "Broker",
    );
    expect(() =>
      requestClarification(client, s, "operations", "Please explain"),
    ).toThrow("Broker");
  });
  it("invalidates approval and exact-state digest after each workflow change", () => {
    const s = approvedPilot();
    expect(finalSubmission(broker, s).revision).toBe(s.revision);
    const requested = requestClarification(
      broker,
      s,
      "operations",
      "Confirm that the scope remains service only.",
    );
    const modified = saveIntakeResponse(
      client,
      s,
      "payroll",
      "25000",
      "answered",
    );
    const invalidDraft = saveIntakeResponse(
      client,
      s,
      "payroll",
      "-1",
      "answered",
    );
    const submitted = submitIntake(client, s, true);
    for (const next of [requested, modified, invalidDraft, submitted]) {
      expect(next.revision).toBe(s.revision + 1);
      expect(next.approval).toBeUndefined();
      expect(next.draft).toBeUndefined();
      expect(fingerprint(next)).not.toBe(s.approval!.digest);
      expect(() => finalSubmission(broker, next)).toThrow();
    }
    expect(intakeView(s)).not.toHaveProperty("approval");
    expect(intakeView(s)).not.toHaveProperty("draft");
  });
});
