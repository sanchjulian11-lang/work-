import { describe, it, expect } from "vitest";
import {
  COVERAGE_RULE_VERSION,
  PREMARKET_RULE_VERSION,
  SCHEDULES,
  scheduleIssues,
  validVIN,
  intakeIssues,
  displayAnswer,
} from "../src/lib/coverage-intake";
import {
  activeQuestions,
  completeness,
  rulesFor,
  RULE_VERSION,
} from "../src/lib/rules";
import {
  saveAnswer,
  verifyAnswer,
  approve,
  attachDraft,
  finalSubmission,
} from "../src/lib/domain";
import {
  sampleBusiness,
  DEMO_BROKER as broker,
  DEMO_CLIENT as client,
} from "../src/lib/sample";
import type { BusinessState } from "../src/lib/types";
const codes = ["cgl", "property", "auto", "equipment", "professional"];
function fresh(version = COVERAGE_RULE_VERSION): BusinessState {
  return {
    ...sampleBusiness(),
    rulesVersion: version,
    answers: {},
    documents: [],
  };
}
function put(s: BusinessState, id: string, value: string) {
  return saveAnswer(broker, s, id, value);
}
function row(id: string, overrides: Record<string, string> = {}) {
  return {
    ...Object.fromEntries(
      SCHEDULES[id].map((f) => [
        f.id,
        f.options?.[0] ??
          (f.type === "number"
            ? f.whole
              ? "2020"
              : "100"
            : "Fictional test response"),
      ]),
    ),
    ...overrides,
  };
}
const location = row("locations", { reference: "LOC-1", tenure: "leased" });
function cglComplete(version = COVERAGE_RULE_VERSION) {
  let s = fresh(version);
  for (const c of codes) s = put(s, `cover_${c}`, c === "cgl" ? "yes" : "no");
  for (const q of activeQuestions(s)) {
    if (s.answers[q.id]) continue;
    const value =
      q.id === "locations"
        ? JSON.stringify([location])
        : q.id === "effective_date"
          ? "2026-11-01"
          : q.id === "revenue_split"
            ? "100% Ontario residential HVAC service"
            : q.id === "market_status"
              ? "common intake only - insurer requirements not assessed"
              : ["market_attestation", "intake_attestation"].includes(q.id)
                ? "yes"
                : q.type === "boolean"
                  ? "no"
                  : q.type === "number"
                    ? "100"
                    : "Fictional confirmed test response.";
    s = put(s, q.id, value);
  }
  for (const q of activeQuestions(s)) s = verifyAnswer(broker, s, q.id);
  return s;
}
it("allows a broker-reviewed pre-market intake to be approved without insurer selection", () => {
  let s = cglComplete(PREMARKET_RULE_VERSION);
  expect(completeness(s).ready).toBe(true);
  expect(activeQuestions(s).some((q) => q.section === "Market review")).toBe(
    false,
  );
  s = attachDraft(
    broker,
    s,
    {
      overviewQuestionIds: activeQuestions(s).map((q) => q.id),
      coverageCodes: ["cgl"],
      followUpQuestionIds: [],
    },
    "rules",
    "test",
  );
  s = approve(broker, s);
  expect(finalSubmission(broker, s).content).toContain(
    "insurer-specific requirements not assessed",
  );
});
describe("versioned coverage-led intake", () => {
  it("keeps original rules and existing account version intact", () => {
    const s = sampleBusiness();
    expect(s.rulesVersion).toBe(RULE_VERSION);
    expect(rulesFor(s).some((q) => q.id === "cover_auto")).toBe(false);
    expect(activeQuestions(s).some((q) => q.id === "vehicle_details")).toBe(
      true,
    );
  });
  it("pins structured field definitions into published rule provenance", () => {
    for (const q of rulesFor(fresh())) {
      expect(q.provenance.version).toBe(COVERAGE_RULE_VERSION);
      if (q.type === "schedule")
        expect(q.scheduleFields).toEqual(SCHEDULES[q.id]);
    }
  });
  it.each(Array.from({ length: 32 }, (_, i) => i))(
    "branches independently for coverage combination %i",
    (mask) => {
      let s = fresh();
      codes.forEach(
        (c, i) => (s = put(s, `cover_${c}`, mask & (1 << i) ? "yes" : "no")),
      );
      s = put(s, "vehicles", "yes");
      const ids = activeQuestions(s).map((q) => q.id);
      for (const [code, id] of [
        ["cgl", "cgl_limits"],
        ["property", "property_schedule"],
        ["auto", "vehicle_schedule"],
        ["equipment", "equipment_schedule"],
        ["professional", "professional_services"],
      ])
        expect(ids.includes(id)).toBe(
          Boolean(mask & (1 << codes.indexOf(code))),
        );
      expect(ids).not.toContain("vehicle_details");
      expect(ids).toContain("vehicles");
    },
  );
  it("requires broker ownership of coverage selection and market decisions", () => {
    expect(() => saveAnswer(client, fresh(), "cover_auto", "yes")).toThrow(
      "Broker role",
    );
    expect(() =>
      saveAnswer(client, fresh(), "market_attestation", "yes"),
    ).toThrow("Broker role");
  });
  it("allows partial schedule capture but blocks verification and approval", () => {
    let s = put(fresh(), "locations", '[{"reference":"LOC-1"}]');
    expect(
      scheduleIssues("locations", s.answers.locations.value).length,
    ).toBeGreaterThan(0);
    expect(() => verifyAnswer(broker, s, "locations")).toThrow("required");
    expect(completeness(s).ready).toBe(false);
    expect(() => approve(broker, s)).toThrow();
  });
  it("blocks malformed schedules, invalid types, unknown fields and duplicate references", () => {
    expect(() => put(fresh(), "locations", '{"reference":"x"}')).toThrow(
      "Invalid schedule",
    );
    expect(() => put(fresh(), "locations", '[{"reference":42}]')).toThrow();
    expect(
      scheduleIssues(
        "locations",
        JSON.stringify([{ ...location, unexpected: "x" }, location]),
      ).join(" "),
    ).toMatch(/unknown field.*duplicate reference/);
  });
  it("validates VIN check digits and rejects incomplete fictional placeholder VINs", () => {
    expect(validVIN("1HGCM82633A004352")).toBe(true);
    expect(validVIN("1HGCM82633A004353")).toBe(false);
    expect(validVIN("VAN-001")).toBe(false);
    expect(validVIN("1HGCM8263IA004352")).toBe(false);
  });
  it("checks driver references and duplicate vehicle VINs", () => {
    let s = put(fresh(), "cover_auto", "yes");
    s = put(
      s,
      "vehicle_schedule",
      JSON.stringify([
        row("vehicle_schedule", {
          reference: "V1",
          vin: "1HGCM82633A004352",
          drivers: "D1",
        }),
        row("vehicle_schedule", {
          reference: "V2",
          vin: "1HGCM82633A004352",
          drivers: "D2",
        }),
      ]),
    );
    s = put(
      s,
      "driver_schedule",
      JSON.stringify([row("driver_schedule", { reference: "D1" })]),
    );
    expect(intakeIssues(s).join(" ")).toContain("VINs must be unique");
    expect(intakeIssues(s).join(" ")).toContain("D2 is missing");
  });
  it("requires property decisions at every location and rejects orphan location references", () => {
    let s = put(fresh(), "cover_property", "yes");
    s = put(s, "locations", JSON.stringify([location]));
    s = put(
      s,
      "property_schedule",
      JSON.stringify([
        row("property_schedule", {
          location: "WRONG",
          insured: "no",
          declinedReason: "Not requested",
        }),
      ]),
    );
    expect(intakeIssues(s).join(" ")).toContain("LOC-1: record property");
    expect(intakeIssues(s).join(" ")).toContain("not in the location records");
  });
  it("permits a documented property decline without collecting building data", () => {
    expect(
      scheduleIssues(
        "property_schedule",
        JSON.stringify([
          {
            location: "LOC-1",
            insured: "no",
            declinedReason: "Fictional client declined property",
          },
        ]),
      ),
    ).toEqual([]);
  });
  it("blocks outstanding external valuation even when an estimated value exists", () => {
    const p = row("property_schedule", {
      insured: "yes",
      buildingCover: "yes",
      valuationStatus: "external valuation outstanding",
    });
    expect(
      scheduleIssues("property_schedule", JSON.stringify([p])).join(" "),
    ).toContain("completed external valuation");
  });
  it("requires the referenced valuation attachment to be reviewed and classified correctly", () => {
    let s = put(fresh(), "cover_property", "yes");
    s = put(s, "locations", JSON.stringify([location]));
    s = put(
      s,
      "property_schedule",
      JSON.stringify([
        row("property_schedule", {
          location: "LOC-1",
          insured: "yes",
          buildingCover: "yes",
          valuationStatus: "external report available",
          valuationDocument: "DOC1",
        }),
      ]),
    );
    expect(intakeIssues(s).join(" ")).toContain("attach and broker-review");
    s.documents = [
      {
        id: "DOC1",
        name: "fictional.pdf",
        kind: "valuation",
        reviewedBy: broker.id,
        reviewedAt: "2026-10-23",
        uploadedBy: broker.id,
        uploadedAt: "2026-10-23",
        path: "private",
        size: 100,
        mime: "application/pdf",
        sha256: "test",
      },
    ];
    expect(intakeIssues(s).join(" ")).not.toContain("attach and broker-review");
  });
  it("revokes module verification when coverage is removed and re-added", () => {
    let s = put(fresh(), "cover_auto", "yes");
    s = put(s, "auto_history", "Fictional confirmed history");
    s = verifyAnswer(broker, s, "auto_history");
    s = put(s, "cover_auto", "no");
    expect(s.answers.auto_history.verifiedBy).toBeUndefined();
    expect(activeQuestions(s).some((q) => q.id === "auto_history")).toBe(false);
    s = put(s, "cover_auto", "yes");
    expect(completeness(s).unverified).toContain("auto_history");
  });
  it("requires below-value equipment explanation and reconciles the item total", () => {
    let s = put(fresh(), "cover_equipment", "yes");
    s = put(s, "equipment_value", "85000");
    s = put(s, "equipment_limit", "50000");
    expect(completeness(s).missing).toContain("equipment_limit_reason");
    s = put(
      s,
      "equipment_limit_reason",
      "Fictional client expressly requested a lower limit",
    );
    s = verifyAnswer(broker, s, "equipment_limit_reason");
    s = put(s, "equipment_value", "90000");
    expect(s.answers.equipment_limit_reason.verifiedBy).toBeUndefined();
    s = put(
      s,
      "equipment_schedule",
      JSON.stringify([
        row("equipment_schedule", { replacementValue: "85000" }),
      ]),
    );
    expect(intakeIssues(s).join(" ")).toContain("reconcile");
    s = put(s, "equipment_limit", "90000");
    expect(
      activeQuestions(s).some((q) => q.id === "equipment_limit_reason"),
    ).toBe(false);
  });
  it("allows common-intake approval but labels it, and revokes approval on coverage change", () => {
    let s = cglComplete();
    expect(completeness(s).ready).toBe(true);
    s = attachDraft(
      broker,
      s,
      {
        overviewQuestionIds: activeQuestions(s).map((q) => q.id),
        coverageCodes: ["cgl"],
        followUpQuestionIds: [],
      },
      "rules",
      "test",
    );
    s = approve(broker, s);
    expect(finalSubmission(broker, s).content).toContain(
      "common intake only - insurer requirements not assessed",
    );
    s = put(s, "cover_auto", "yes");
    expect(s.approval).toBeUndefined();
    expect(() => finalSubmission(broker, s)).toThrow();
  });
  it("rejects impossible dates and does not claim insurer completeness by default", () => {
    let s = put(fresh(), "effective_date", "2026-02-30");
    expect(intakeIssues(s).join(" ")).toContain("valid YYYY-MM-DD");
    expect(intakeIssues(s).join(" ")).toContain("confirmed");
  });
  it("renders schedule fields as readable statements without leaking dormant fields", () => {
    const text = displayAnswer(
      "property_schedule",
      JSON.stringify([
        {
          location: "LOC-1",
          insured: "no",
          declinedReason: "Not requested",
          buildingValue: "999999",
        },
      ]),
    );
    expect(text).toContain("Linked location");
    expect(text).not.toContain("LOC-1");
    expect(text).not.toContain("999999");
  });
});

it("requires a completed requirement register for a selected market", () => {
  let s = put(
    fresh(),
    "market_status",
    "selected market requirements reviewed",
  );
  expect(completeness(s).missing).toContain("market_requirements");
  s = put(
    s,
    "market_requirements",
    JSON.stringify([
      row("market_requirements", {
        coverage: "cgl",
        status: "unresolved",
        attachmentRequired: "no",
      }),
    ]),
  );
  expect(() => verifyAnswer(broker, s, "market_requirements")).toThrow(
    "unresolved",
  );
  s = put(
    s,
    "market_requirements",
    JSON.stringify([
      row("market_requirements", {
        coverage: "auto",
        status: "satisfied",
        attachmentRequired: "yes",
        documentId: "missing",
      }),
    ]),
  );
  expect(intakeIssues(s).join(" ")).toContain("attachment must exist");
  expect(intakeIssues(s).join(" ")).toContain("unselected coverage");
});
it("does not treat dormant property fields as current missing information", () => {
  let s = put(fresh(), "cover_property", "yes");
  s = put(s, "locations", JSON.stringify([location]));
  s = put(
    s,
    "property_schedule",
    JSON.stringify([
      {
        location: "LOC-1",
        insured: "no",
        declinedReason: "Fictional client declined coverage",
        valuationBasis: "pending",
        buildingValue: "unknown",
      },
    ]),
  );
  expect(completeness(s).profileIssues.join(" ")).not.toContain(
    "Property and valuation",
  );
});
it("revokes the final market attestation and linked schedules after dependent edits", () => {
  let s = cglComplete();
  s = put(s, "market_review", "Fictional revised market review");
  expect(s.answers.market_attestation.verifiedBy).toBeUndefined();
  s = put(s, "cover_auto", "yes");
  s = put(s, "auto_history", "Fictional full auto history");
  s = verifyAnswer(broker, s, "auto_history");
  s = put(s, "cover_auto", "no");
  expect(s.answers.auto_history.verifiedBy).toBeUndefined();
});

it("retains exact published v1 and v2 definitions while v3 gates vehicle use by auto selection", async () => {
  const { createHash } = await import("node:crypto");
  const { RULESETS, coverageCodes } = await import("../src/lib/rules");
  const { LATEST_RULE_VERSION } = await import("../src/lib/coverage-intake");
  expect(
    createHash("sha256")
      .update(JSON.stringify(RULESETS[RULE_VERSION]))
      .digest("hex"),
  ).toBe("8fb357e5cbd410f71661b216dd488b10377e6937c17bb971a0188f921bbba023");
  expect(
    createHash("sha256")
      .update(JSON.stringify(RULESETS[COVERAGE_RULE_VERSION]))
      .digest("hex"),
  ).toBe("bfa89eb7736b8c98acb458637c954ae959344e15e287cab09407b669613e1c47");
  let s = { ...fresh(), rulesVersion: LATEST_RULE_VERSION };
  s = put(s, "cover_cgl", "yes");
  s = put(s, "cover_auto", "no");
  expect(activeQuestions(s).some((q) => q.id === "vehicles")).toBe(false);
  // Retained historical exposure answers must not re-open auto or enter the export.
  s.answers.vehicles = { ...sampleBusiness().answers.vehicles };
  expect(coverageCodes(s)).not.toContain("auto");
  s = put(s, "cover_auto", "yes");
  expect(activeQuestions(s).some((q) => q.id === "vehicles")).toBe(true);
});
it("creates an explicit updated copy without carrying approval, verification, attachments or client access", async () => {
  const { updatedIntakeCopy } = await import("../src/lib/domain");
  const { PREMARKET_RULE_VERSION } = await import("../src/lib/coverage-intake");
  const s = cglComplete();
  const before = JSON.stringify(s);
  const copy = updatedIntakeCopy(broker, s);
  expect(copy.rulesVersion).toBe(PREMARKET_RULE_VERSION);
  expect(copy.id).not.toBe(s.id);
  expect(copy.answers.cover_cgl.value).toBe("yes");
  expect(copy.answers.cover_cgl.source).toBe(s.answers.cover_cgl.source);
  expect(copy.answers.cover_cgl.verifiedBy).toBeUndefined();
  expect(copy.documents).toEqual([]);
  expect(copy.assignedClientIds).toEqual([]);
  expect(copy.approval).toBeUndefined();
  expect(copy.copiedFrom?.businessId).toBe(s.id);
  expect(JSON.stringify(s)).toBe(before);
  expect(() => updatedIntakeCopy(client, s)).toThrow("Broker role");
});

describe("published schedule definitions", () => {
  it("keeps existing field validation and exports isolated from future schedule changes", () => {
    const state = fresh();
    const pinned = rulesFor(state).find(
      (q) => q.id === "locations",
    )!.scheduleFields!;
    const original = structuredClone(SCHEDULES.locations);
    const value = JSON.stringify([
      {
        reference: "LOC-1",
        address: "123 Test Street",
        tenure: "leased",
        occupancy: "Office",
        responsibilities: "Tenant contents",
      },
    ]);
    const beforeIssues = scheduleIssues("locations", value, pinned);
    const beforeDisplay = displayAnswer("locations", value, [], [], pinned);
    try {
      SCHEDULES.locations[1].label = "Future changed label";
      SCHEDULES.locations.push({
        id: "futureField",
        label: "Future requirement",
        required: true,
      });
      expect(pinned).toEqual(original);
      expect(scheduleIssues("locations", value, pinned)).toEqual(beforeIssues);
      expect(displayAnswer("locations", value, [], [], pinned)).toEqual(
        beforeDisplay,
      );
      expect(scheduleIssues("locations", value)).toContain(
        "Record 1: Future requirement is required.",
      );
    } finally {
      SCHEDULES.locations.splice(0, SCHEDULES.locations.length, ...original);
    }
  });
  it("does not parse ordinary narrative answers as schedules", () => {
    expect(
      scheduleIssues("operations", "Installation and repairs", []),
    ).toEqual([]);
    expect(
      displayAnswer("operations", "Installation and repairs", [], [], []),
    ).toBe("Installation and repairs");
  });
});
