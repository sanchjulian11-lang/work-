import { describe, it, expect } from "vitest";
import {
  activeQuestions,
  completeness,
  coverageCodes,
  RULE_VERSION,
  validateAnswer,
} from "../src/lib/rules";
import {
  approve,
  assertAccess,
  attachDraft,
  changed,
  finalSubmission,
  saveAnswer,
  validatePlan,
  verifyAnswer,
  fingerprint,
} from "../src/lib/domain";
import {
  DEMO_BROKER as broker,
  DEMO_CLIENT as client,
  sampleBusiness,
} from "../src/lib/sample";
import { inspectUpload, MAX_UPLOAD_BYTES } from "../src/lib/documents";
import type { BusinessState } from "../src/lib/types";
function complete(): BusinessState {
  let s = sampleBusiness();
  for (const q of activeQuestions(s)) {
    const value =
      q.type === "boolean"
        ? (s.answers[q.id]?.value ?? "no")
        : q.type === "number"
          ? (s.answers[q.id]?.value ?? "100")
          : q.id === "revenue_split"
            ? "60% residential service, 20% residential installation, 20% commercial service."
            : "Fictional confirmed demonstration response.";
    s = saveAnswer(client, s, q.id, value);
  }
  for (const q of activeQuestions(s)) s = verifyAnswer(broker, s, q.id);
  return s;
}
function draft(s: BusinessState) {
  return attachDraft(
    broker,
    s,
    {
      overviewQuestionIds: activeQuestions(s)
        .filter((q) => s.answers[q.id]?.verifiedBy)
        .map((q) => q.id),
      coverageCodes: coverageCodes(s),
      followUpQuestionIds: [],
    },
    "rules",
    "test",
  );
}
describe("contractor questionnaire and provenance", () => {
  it("triggers subcontractor, hot-work, and HVAC questions", () => {
    const ids = activeQuestions(sampleBusiness()).map((q) => q.id);
    expect(ids).toContain("subcontract_controls");
    expect(ids).toContain("hot_work_controls");
    expect(ids).toContain("refrigerant_controls");
    expect(ids).not.toContain("electrical_scope");
  });
  it("hides follow-ups on no and revokes dependent verification", () => {
    let s = complete();
    s = saveAnswer(client, s, "hot_work", "no");
    expect(activeQuestions(s).some((q) => q.id === "hot_work_controls")).toBe(
      false,
    );
    expect(s.answers.hot_work_controls.verifiedBy).toBeUndefined();
    s = saveAnswer(client, s, "hot_work", "yes");
    expect(completeness(s).unverified).toContain("hot_work_controls");
  });
  it("distinguishes client and broker records", () => {
    let s = saveAnswer(client, sampleBusiness(), "payroll", "123");
    expect(s.answers.payroll.source).toBe("client_statement");
    expect(s.answers.payroll.questionVersion).toBe(RULE_VERSION);
    s = saveAnswer(broker, s, "payroll", "456");
    expect(s.answers.payroll.source).toBe("broker_recorded");
    expect(s.answers.payroll.verifiedBy).toBeUndefined();
  });
  it("rejects unknown, inactive, malformed boolean, negative and non-finite values", () => {
    const s = sampleBusiness();
    for (const [id, value] of [
      ["unknown", "x"],
      ["claims_details", "x"],
      ["hot_work", "maybe"],
      ["payroll", "-1"],
      ["revenue", "Infinity"],
      ["employees", "1.5"],
    ])
      expect(() => validateAnswer(s, id, value)).toThrow();
  });
  it("does not invent missing answers", () => {
    const s = sampleBusiness();
    expect(s.answers.vehicle_details).toBeUndefined();
    expect(completeness(s).missing).toContain("vehicle_details");
    expect(completeness(s).ready).toBe(false);
  });
  it("blocks incomplete prose and incorrect percentage totals", () => {
    let s = complete();
    s = saveAnswer(
      client,
      s,
      "revenue_split",
      "80% residential, 40% commercial",
    );
    expect(completeness(s).profileIssues.some((x) => x.includes("100%"))).toBe(
      true,
    );
    s = saveAnswer(client, s, "experience", "Licences pending");
    expect(
      completeness(s).profileIssues.some((x) =>
        x.includes("incomplete statement"),
      ),
    ).toBe(true);
  });
  it("requires reviewed loss records when losses are reported", () => {
    let s = complete();
    s = saveAnswer(client, s, "claims", "yes");
    expect(activeQuestions(s).some((q) => q.id === "claims_details")).toBe(
      true,
    );
    expect(completeness(s).documentIssues.length).toBe(1);
  });
  it.each([
    "Fictional test scenario: two company-owned service vans used for HVAC service calls within 100 km of London, Ontario. Jamie Chen and Alex Patel are the designated drivers. No deliveries for others or cross-border travel. Vehicle identification and driver licence details have not been supplied.",
    "Vehicle details have not been provided.",
    "Driver licence details have not yet been supplied.",
    "Vehicle identification is not supplied.",
    "Driver licence details are not yet confirmed.",
  ])(
    "blocks approval when a recorded answer explicitly admits missing details: %s",
    (value) => {
      let s = complete();
      s = saveAnswer(client, s, "vehicle_details", value);
      s = verifyAnswer(broker, s, "vehicle_details");
      const check = completeness(s);
      expect(check.missing).toEqual([]);
      expect(check.unverified).toEqual([]);
      expect(check.profileIssues).toContain(
        "Resolve incomplete statement: Vehicle schedule, ownership, use, radius, and driver information",
      );
      expect(check.ready).toBe(false);
      expect(() => approve(broker, draft(s))).toThrow("Resolve");
    },
  );
  it("does not mistake a negative exposure statement for missing information", () => {
    const s = saveAnswer(
      client,
      complete(),
      "vehicle_details",
      "Fictional vehicles operate in Ontario only. No deliveries for others or cross-border travel. Vehicle and driver schedules are attached.",
    );
    expect(completeness(s).profileIssues).toEqual([]);
  });
  it("refuses unknown industry-rule versions", () => {
    const s = sampleBusiness();
    s.rulesVersion = "unknown";
    expect(() => activeQuestions(s)).toThrow("Unsupported");
  });
});
describe("access and approval controls", () => {
  it("denies other tenants and unassigned clients", () => {
    const s = sampleBusiness();
    expect(() =>
      assertAccess({ ...broker, organizationId: "another" }, s),
    ).toThrow();
    expect(() => assertAccess({ ...client, id: "other" }, s)).toThrow();
  });
  it("blocks clients from verification, drafts, approval and final output", () => {
    const s = complete();
    expect(() => verifyAnswer(client, s, "revenue")).toThrow("Broker");
    expect(() =>
      attachDraft(
        client,
        s,
        { overviewQuestionIds: [], coverageCodes: [], followUpQuestionIds: [] },
        "rules",
        "test",
      ),
    ).toThrow("Broker");
    expect(() => approve(client, s)).toThrow("Broker");
    expect(() => finalSubmission(client, s)).toThrow("Broker");
  });
  it("blocks incomplete and unapproved submissions", () => {
    expect(() => approve(broker, sampleBusiness())).toThrow("Resolve");
    expect(() => finalSubmission(broker, complete())).toThrow("approval");
    expect(() => approve(broker, complete())).toThrow("draft");
  });
  it("permits a final immutable export only after exact-revision approval", () => {
    const s = approve(broker, draft(complete()));
    const out = finalSubmission(broker, s);
    expect(out.approvalId).toBe(s.approval?.id);
    expect(out.content).toContain("Broker-approved");
    expect(out.content).toContain("inferences, not coverage determinations");
    expect(out.content).not.toContain("Not provided");
  });
  it("invalidates approval and draft after answers change", () => {
    const s = approve(broker, draft(complete()));
    const edited = saveAnswer(client, s, "payroll", "300000");
    expect(edited.approval).toBeUndefined();
    expect(edited.draft).toBeUndefined();
    expect(() => finalSubmission(broker, edited)).toThrow();
  });
  it("invalidates approval on document and profile mutations", () => {
    const s = approve(broker, draft(complete()));
    expect(changed(s).approval).toBeUndefined();
  });
  it("rejects tampered approved data even if revision is unchanged", () => {
    const s = approve(broker, draft(complete()));
    s.profile.city = "Toronto";
    expect(() => finalSubmission(broker, s)).toThrow();
  });
  it("rejects AI invented, unverified, irrelevant, or inactive references", () => {
    const s = sampleBusiness();
    for (const plan of [
      {
        overviewQuestionIds: ["revenue"],
        coverageCodes: [],
        followUpQuestionIds: [],
      },
      {
        overviewQuestionIds: [],
        coverageCodes: ["invented"],
        followUpQuestionIds: [],
      },
      {
        overviewQuestionIds: [],
        coverageCodes: [],
        followUpQuestionIds: ["electrical_scope"],
      },
    ])
      expect(() => validatePlan(s, plan)).toThrow("unsupported");
  });
  it("escapes client-controlled Markdown in final exports", () => {
    let s = complete();
    s = saveAnswer(
      client,
      s,
      "operations",
      "Service work\n# Forged approval <script>alert(1)</script>",
    );
    s = verifyAnswer(broker, s, "operations");
    s = approve(broker, draft(s));
    const text = finalSubmission(broker, s).content;
    expect(text).not.toContain("\n# Forged");
    expect(text).not.toContain("<script>");
  });
  it("hash is stable across JSON key ordering", () => {
    const s = sampleBusiness();
    const reversed = Object.fromEntries(
      Object.entries(s).reverse(),
    ) as unknown as BusinessState;
    expect(fingerprint(s)).toBe(fingerprint(reversed));
  });
});
describe("document validation", () => {
  it("accepts a matching PDF signature and produces a content hash", () => {
    const result = inspectUpload(
      "loss.pdf",
      Buffer.from("%PDF-1.7\nfictional"),
    );
    expect(result.mime).toBe("application/pdf");
    expect(result.sha256).toHaveLength(64);
  });
  it("rejects spoofed formats, mismatched extensions, empty and oversized files", () => {
    for (const [name, bytes] of [
      ["bad.pdf", Buffer.from("<script>")],
      ["bad.html", Buffer.from("%PDF-1.7")],
      ["empty.pdf", Buffer.alloc(0)],
      ["large.pdf", Buffer.alloc(MAX_UPLOAD_BYTES + 1)],
    ] as const)
      expect(() => inspectUpload(name, bytes)).toThrow();
  });
});
export { complete, draft };
