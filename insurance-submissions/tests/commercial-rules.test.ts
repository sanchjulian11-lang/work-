import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import {
  COMMERCIAL_RULE_VERSION,
  LATEST_RULE_VERSION,
} from "../src/lib/coverage-intake";
import { activeQuestions, RULESETS, RULE_VERSION } from "../src/lib/rules";
import { COVERAGE_RULE_VERSION } from "../src/lib/coverage-intake";
import { sampleBusiness } from "../src/lib/sample";
import { saveAnswer, updatedIntakeCopy } from "../src/lib/domain";
import { DEMO_BROKER } from "../src/lib/sample";
import type { BusinessState, Profile } from "../src/lib/types";
function business(industry: Profile["industry"]): BusinessState {
  return {
    ...sampleBusiness(),
    rulesVersion: COMMERCIAL_RULE_VERSION,
    profile: { ...sampleBusiness().profile, industry },
    answers: {},
    documents: [],
    approval: undefined,
    draft: undefined,
  };
}
const ids = (s: BusinessState) => activeQuestions(s).map((q) => q.id);
describe("Ontario commercial class intake", () => {
  it("preserves previously published contractor definitions", () => {
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
    expect(
      RULESETS[LATEST_RULE_VERSION].find((q) => q.id === "cgl_operations")
        ?.label,
    ).toContain("residential/commercial/industrial");
  });
  it("asks retail activity questions without contractor trade questions and opens import follow-up", () => {
    let s = business("retail");
    expect(ids(s)).toContain("retail_product_mix");
    expect(ids(s)).not.toContain("hot_work");
    expect(ids(s)).not.toContain("experience");
    expect(ids(s)).not.toContain("retail_import_details");
    s = saveAnswer(DEMO_BROKER, s, "retail_imports", "yes");
    expect(ids(s)).toContain("retail_import_details");
    s = saveAnswer(DEMO_BROKER, s, "retail_imports", "no");
    expect(ids(s)).not.toContain("retail_import_details");
  });
  it("asks rental property questions and short-term follow-up only when applicable", () => {
    let s = business("rental_property");
    expect(ids(s)).toContain("rental_occupancies");
    expect(ids(s)).not.toContain("rental_short_term_details");
    s = saveAnswer(DEMO_BROKER, s, "rental_short_term", "yes");
    expect(ids(s)).toContain("rental_short_term_details");
    expect(ids(s)).not.toContain("demolition");
  });
  it("asks professional service questions without contractor trade questions", () => {
    const s = business("professional_services");
    expect(ids(s)).toContain("service_contracts");
    expect(ids(s)).not.toContain("demolition");
    expect(ids(s)).not.toContain("subcontract_controls");
  });
  it("copies older applications to the current version without carrying approval or verification", () => {
    const copy = updatedIntakeCopy(DEMO_BROKER, {
      ...sampleBusiness(),
      rulesVersion: LATEST_RULE_VERSION,
      approval: undefined,
    });
    expect(copy.rulesVersion).toBe(COMMERCIAL_RULE_VERSION);
    expect(copy.documents).toEqual([]);
    expect(copy.assignedClientIds).toEqual([]);
    expect(copy.approval).toBeUndefined();
    expect(copy.answers.operations?.verifiedBy).toBeUndefined();
  });
});
