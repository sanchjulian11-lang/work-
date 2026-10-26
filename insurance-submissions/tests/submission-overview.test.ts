import { describe, expect, it } from "vitest";
import { COMMERCIAL_RULE_VERSION } from "../src/lib/coverage-intake";
import { completeness } from "../src/lib/rules";
import { submissionOverview } from "../src/lib/submission-overview";
import { sampleBusiness } from "../src/lib/sample";
import type { BusinessState } from "../src/lib/types";
function retail(): BusinessState {
  const s = sampleBusiness();
  return {
    ...s,
    profile: { ...s.profile, industry: "retail" },
    rulesVersion: COMMERCIAL_RULE_VERSION,
    answers: {},
    documents: [],
  };
}
const recorded = (value: string, verified = true) => ({
  value,
  source: "broker_recorded" as const,
  recordedBy: "broker",
  recordedAt: "2026-10-25T00:00:00Z",
  questionVersion: COMMERCIAL_RULE_VERSION,
  ...(verified
    ? { verifiedBy: "broker", verifiedAt: "2026-10-25T00:00:00Z" }
    : {}),
});
describe("submission overview", () => {
  it("lists selected coverage and verified facts without repeating unverified claims or hidden branches", () => {
    const s = retail();
    s.answers.cover_cgl = recorded("yes");
    s.answers.cover_auto = recorded("no");
    s.answers.operations = recorded("Retail shop selling Canadian-made goods.");
    s.answers.cgl_limits = recorded("$2 million CGL", false);
    s.answers.retail_imports = recorded("no");
    s.answers.retail_import_details = recorded("Imports dangerous products.");
    const summary = submissionOverview(s).join("\n");
    expect(summary).toContain("Commercial general liability");
    expect(summary).toContain("Retail shop selling Canadian-made goods.");
    expect(summary).not.toContain("Commercial automobile");
    expect(summary).not.toContain("$2 million CGL");
    expect(summary).not.toContain("Imports dangerous products.");
  });
  it("flags incomplete revenue splits for each new class without imposing another class's split", () => {
    const service = {
      ...retail(),
      profile: {
        ...retail().profile,
        industry: "professional_services" as const,
      },
    };
    service.answers.service_revenue_split = recorded(
      "Consulting 65%; training 25%",
    );
    expect(
      completeness(service).profileIssues.some((x) =>
        x.includes("percentages must total 100%"),
      ),
    ).toBe(true);
    service.answers.service_revenue_split = recorded(
      "Consulting 65%; training 35%",
    );
    expect(
      completeness(service).profileIssues.some((x) =>
        x.includes("percentages must total 100%"),
      ),
    ).toBe(false);
    const rental = {
      ...retail(),
      profile: { ...retail().profile, industry: "rental_property" as const },
    };
    rental.answers.service_revenue_split = recorded("Consulting 10%");
    expect(
      completeness(rental).profileIssues.some((x) =>
        x.includes("percentages must total 100%"),
      ),
    ).toBe(false);
  });
});
