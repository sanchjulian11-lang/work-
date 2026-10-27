import { activeQuestions, isVerified } from "./rules";
import type { BusinessState } from "./types";
import { PREMARKET_RULE_VERSION } from "./coverage-intake";

const classNames: Record<string, string> = {
  hvac: "HVAC contractor",
  electrical: "Electrical contractor",
  plumbing: "Plumbing contractor",
  general: "General contractor",
  professional_services: "Professional services",
  retail: "Retail",
  rental_property: "Rental property owner",
};

// A short, deterministic cover sheet. Every client fact below comes from an
// active, broker-verified answer in the approved application.
export function submissionOverview(s: BusinessState): string[] {
  const active = new Set(activeQuestions(s).map((q) => q.id));
  const answer = (id: string) =>
    active.has(id) && isVerified(s, id)
      ? s.answers[id]?.value.trim()
      : undefined;
  const selected = [
    ["cover_cgl", "Commercial general liability"],
    ["cover_property", "Commercial property / business interruption"],
    ["cover_auto", "Commercial automobile"],
    ["cover_equipment", "Tools / movable equipment"],
    ["cover_professional", "Professional liability / E&O"],
  ]
    .filter(([id]) => answer(id) === "yes")
    .map(([, name]) => name);
  const lines = [
    `Business type: ${classNames[s.profile.industry] ?? s.profile.industry}`,
    `Requested effective date: ${answer("effective_date") ?? "See recorded terms below"}`,
    `Requested coverage: ${selected.length ? selected.join("; ") : (answer("coverage_request") ?? "See recorded terms below")}`,
    `Submission scope: ${s.rulesVersion === PREMARKET_RULE_VERSION ? "Broker-reviewed common intake; insurer-specific requirements not assessed" : (answer("market_status") ?? "See market review below")}`,
    `Supporting documents: ${s.documents.length} reviewed file${s.documents.length === 1 ? "" : "s"}; attach separately.`,
  ];
  if (answer("operations"))
    lines.push(
      `Operations (broker-reviewed statement): ${answer("operations")}`,
    );
  if (answer("cgl_limits"))
    lines.push(`Requested CGL terms: ${answer("cgl_limits")}`);
  if (answer("professional_request"))
    lines.push(`Requested E&O terms: ${answer("professional_request")}`);
  if (answer("current_insurance"))
    lines.push(`Current insurance: ${answer("current_insurance")}`);
  if (answer("claims"))
    lines.push(
      `Reported claims or incidents in the past five years: ${answer("claims")}`,
    );
  lines.push(
    "Property, vehicle, driver, equipment and other details follow where requested.",
  );
  return lines;
}
