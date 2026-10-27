import { PREMARKET_RULE_VERSION } from "./coverage-intake";
import { commercialRules } from "./commercial-rules";
import type { Rule } from "./types";

// The broker completes this intake before choosing a market. Keep the v4
// market-specific rules intact for applications already published under v4.
export function premarketRules(legacy: Rule[]): Rule[] {
  const obsolete = new Set([
    "market_review",
    "market_status",
    "market_requirements",
    "market_attestation",
  ]);
  const base = commercialRules(legacy)
    .filter((q) => !obsolete.has(q.id))
    .map((q) => ({
      ...q,
      provenance: { ...q.provenance, version: PREMARKET_RULE_VERSION },
    }));
  return [
    ...base,
    {
      id: "intake_attestation",
      label:
        "I reviewed the recorded intake, requested coverages, outstanding items and attachments before preparing this submission",
      section: "Broker intake review",
      type: "boolean",
      required: true,
      dependsOn: base.map((q) => q.id),
      provenance: {
        source:
          "Internal pre-market broker review; insurer-specific requirements are outside this intake",
        reference: "UW-PREMARKET/intake_attestation",
        version: PREMARKET_RULE_VERSION,
        owner: "broker",
      },
    },
  ];
}
