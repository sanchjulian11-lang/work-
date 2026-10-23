import type { BusinessState, Rule } from "./types";
export const COVERAGE_RULE_VERSION = "ontario-contractors-2026.10.23-v2";
export const LATEST_RULE_VERSION = "ontario-contractors-2026.10.23-v3";
export const coverageLed = (version: string) =>
  [COVERAGE_RULE_VERSION, LATEST_RULE_VERSION].includes(version);
export type ScheduleField = {
  id: string;
  label: string;
  type?: "number" | "date" | "select" | "document";
  options?: string[];
  required?: boolean;
  min?: number;
  max?: number;
  whole?: boolean;
  when?: { id: string; equals: string };
};
const field = (
  id: string,
  label: string,
  extra: Partial<ScheduleField> = {},
): ScheduleField => ({ id, label, required: true, ...extra });
const choice = (id: string, label: string, options: string[]) =>
  field(id, label, { type: "select", options });
const amount = (
  id: string,
  label: string,
  extra: Partial<ScheduleField> = {},
) => field(id, label, { type: "number", ...extra });
export const SCHEDULES: Record<string, ScheduleField[]> = {
  market_requirements: [
    choice("coverage", "Applicable coverage", [
      "cgl",
      "property",
      "auto",
      "equipment",
      "professional",
      "package",
    ]),
    field("requirement", "Exact market requirement"),
    field("source", "Insurer / program and document title or source URL"),
    field("edition", "Form number / edition and date checked"),
    choice("status", "Requirement status", [
      "unresolved",
      "satisfied",
      "not applicable",
    ]),
    field(
      "basis",
      "Evidence / answer references or documented non-applicability rationale",
    ),
    choice("attachmentRequired", "Does this requirement need an attachment?", [
      "yes",
      "no",
    ]),
    field("documentId", "Uploaded supporting document", {
      type: "document",
      when: { id: "attachmentRequired", equals: "yes" },
    }),
  ],
  locations: [
    field("reference", "Location reference (unique, e.g. LOC-1)"),
    field("address", "Full civic address and postal code"),
    choice("tenure", "Tenure", ["owned", "leased", "other"]),
    field(
      "occupancy",
      "Your occupancy, other occupants, and neighbouring exposures",
    ),
    field(
      "leaseResponsibilities",
      "Lease / ownership responsibilities and insurance obligations",
    ),
  ],
  property_schedule: [
    field("location", "Location reference from location records"),
    choice("insured", "Property coverage requested at this location?", [
      "yes",
      "no",
    ]),
    field("declinedReason", "Reason property coverage is not requested here", {
      when: { id: "insured", equals: "no" },
    }),
    choice("buildingCover", "Building coverage requested?", ["yes", "no"]),
    field("construction", "Wall, roof, and floor construction"),
    amount("yearBuilt", "Year built", { min: 1600, max: 2028, whole: true }),
    amount("area", "Building area (sq ft)", { min: 1 }),
    field("systems", "Roof, heating, wiring, plumbing: types and update years"),
    field(
      "protection",
      "Fire service, hydrant distance, alarms, sprinklers, security",
    ),
    field(
      "hazards",
      "Vacancy, flood/water exposure, hazardous storage and loss prevention",
    ),
    amount("buildingValue", "Building replacement value (CAD)", {
      when: { id: "buildingCover", equals: "yes" },
    }),
    choice("valuationStatus", "Building valuation status", [
      "external report available",
      "external valuation outstanding",
      "broker-documented alternative",
      "not applicable",
    ]),
    field(
      "valuationBasis",
      "Valuation source, date, preparer, or outstanding information",
      { when: { id: "buildingCover", equals: "yes" } },
    ),
    field("valuationDocument", "Uploaded valuation report", {
      type: "document",
      required: false,
    }),
    amount("contents", "Contents replacement value (CAD)"),
    amount("improvements", "Tenant improvements replacement value (CAD)"),
    amount("stock", "Stock value (CAD)"),
    field(
      "businessInterruption",
      "Business interruption basis, amount, indemnity period, or explicit not requested",
    ),
    field("deductibles", "Requested property deductibles and perils"),
  ],
  vehicle_schedule: [
    field("reference", "Vehicle reference (unique, e.g. VEH-1)"),
    field(
      "vin",
      "VIN (17 characters; refer older/nonstandard vehicles separately)",
    ),
    amount("year", "Model year", { min: 1886, max: 2028, whole: true }),
    field("makeModel", "Make and model"),
    choice("ownership", "Ownership", ["owned", "leased", "financed"]),
    field("registeredOwner", "Registered owner / lessor"),
    field("use", "Use, goods carried, and any delivery / passenger activity"),
    amount("radius", "Operating radius (km)"),
    field("territory", "Garaging address and operating territories"),
    field("drivers", "Assigned driver references from driver schedule"),
    field(
      "coverage",
      "Requested liability, physical damage, deductibles and endorsements",
    ),
    field("value", "Vehicle value and valuation basis"),
  ],
  driver_schedule: [
    field("reference", "Driver reference (unique, e.g. DRV-1)"),
    field("name", "Full driver name"),
    field("licence", "Licence number (collect with appropriate authorization)"),
    field("jurisdiction", "Licensing jurisdiction"),
    field("class", "Licence class"),
    field("experience", "Years licensed and commercial driving experience"),
    field(
      "record",
      "Convictions, suspensions, claims and dates; state none if applicable",
    ),
    field(
      "abstract",
      "Driver abstract status, date and document reference; identify outstanding records",
    ),
  ],
  equipment_schedule: [
    field("reference", "Item / category reference (unique)"),
    field(
      "description",
      "Description, make/model and serial number where applicable",
    ),
    choice("ownership", "Ownership", ["owned", "leased", "rented", "borrowed"]),
    amount("replacementValue", "Replacement value (CAD)"),
    field("basis", "Valuation basis and date"),
    field("territory", "Storage, transport and work territories"),
  ],
};
export function scheduleRows(value: string): Record<string, string>[] {
  try {
    const rows = JSON.parse(value);
    if (
      !Array.isArray(rows) ||
      rows.length > 50 ||
      rows.some(
        (r) =>
          !r ||
          typeof r !== "object" ||
          Array.isArray(r) ||
          Object.values(r).some((v) => typeof v !== "string"),
      )
    )
      throw 0;
    return rows;
  } catch {
    throw new Error(
      "Invalid schedule. Use the structured row fields (maximum 50 records).",
    );
  }
}
export function scheduleFieldActive(
  id: string,
  f: ScheduleField,
  row: Record<string, string>,
): boolean {
  if (
    id === "property_schedule" &&
    row.insured === "no" &&
    !["location", "insured", "declinedReason"].includes(f.id)
  )
    return false;
  return !f.when || row[f.when.id] === f.when.equals;
}
export function scheduleIssues(id: string, value: string): string[] {
  const fields = SCHEDULES[id];
  if (!fields) return [];
  let rows: Record<string, string>[];
  try {
    rows = scheduleRows(value);
  } catch (e) {
    return [(e as Error).message];
  }
  if (!rows.length) return ["Add at least one record."];
  const issues: string[] = [];
  const refs = new Set<string>();
  rows.forEach((row, i) => {
    const prefix = `Record ${i + 1}`;
    if (Object.keys(row).some((k) => !fields.some((f) => f.id === k)))
      issues.push(`${prefix}: unknown field.`);
    for (const f of fields) {
      if (!scheduleFieldActive(id, f, row)) continue;
      const v = row[f.id]?.trim();
      if (!v) {
        if (f.required) issues.push(`${prefix}: ${f.label} is required.`);
        continue;
      }
      if (v.length > 2000) issues.push(`${prefix}: ${f.label} is too long.`);
      if (
        f.type === "number" &&
        (!/^\d+(?:\.\d+)?$/.test(v) ||
          !Number.isFinite(Number(v)) ||
          Number(v) < (f.min ?? 0) ||
          Number(v) > (f.max ?? 1e10) ||
          (f.whole && !Number.isInteger(Number(v))))
      )
        issues.push(
          `${prefix}: ${f.label} must be ${f.whole ? "a whole number" : "a number"} between ${f.min ?? 0} and ${f.max ?? 1e10}.`,
        );
      if (f.options && !f.options.includes(row[f.id]))
        issues.push(`${prefix}: invalid ${f.label}.`);
    }
    if (id === "market_requirements" && row.status === "unresolved")
      issues.push(`${prefix}: market requirement remains unresolved.`);
    if (
      id === "property_schedule" &&
      row.insured === "yes" &&
      row.buildingCover === "yes" &&
      row.buildingValue?.trim() &&
      Number(row.buildingValue) <= 0
    )
      issues.push(
        `${prefix}: requested building coverage needs a positive replacement value.`,
      );
    if (row.reference) {
      if (refs.has(row.reference))
        issues.push(`${prefix}: duplicate reference.`);
      refs.add(row.reference);
    }
    if (id === "vehicle_schedule" && row.vin && !validVIN(row.vin))
      issues.push(
        `${prefix}: VIN format or check digit is invalid. Refer nonstandard vehicles for broker review.`,
      );
    if (
      id === "property_schedule" &&
      row.insured !== "no" &&
      row.buildingCover === "yes" &&
      ["external valuation outstanding", "not applicable"].includes(
        row.valuationStatus,
      )
    )
      issues.push(
        `${prefix}: building value needs a completed external valuation or documented broker-reviewed alternative.`,
      );
  });
  return issues;
}
export function validVIN(v: string) {
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(v)) return false;
  const map: Record<string, number> = {
    A: 1,
    B: 2,
    C: 3,
    D: 4,
    E: 5,
    F: 6,
    G: 7,
    H: 8,
    J: 1,
    K: 2,
    L: 3,
    M: 4,
    N: 5,
    P: 7,
    R: 9,
    S: 2,
    T: 3,
    U: 4,
    V: 5,
    W: 6,
    X: 7,
    Y: 8,
    Z: 9,
  };
  const weights = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];
  const rem =
    [...v].reduce((sum, c, i) => sum + (map[c] ?? Number(c)) * weights[i], 0) %
    11;
  return v[8] === (rem === 10 ? "X" : String(rem));
}
const rule = (
  id: string,
  label: string,
  section: string,
  type: Rule["type"] = "text",
  extra: Partial<Rule> = {},
): Rule => ({
  id,
  label,
  section,
  type,
  required: true,
  ...(type === "schedule" ? { scheduleFields: SCHEDULES[id] } : {}),
  provenance: {
    source:
      "Internal Ontario contractor intake baseline; broker validation required, not an insurer form",
    reference: `UW-COVERAGE-002/${id}`,
    version: COVERAGE_RULE_VERSION,
    owner: "client",
  },
  ...extra,
});
const brokerRule = (
  id: string,
  label: string,
  section: string,
  type: Rule["type"] = "text",
  extra: Partial<Rule> = {},
) => ({
  ...rule(id, label, section, type, extra),
  provenance: {
    ...rule(id, label, section).provenance,
    owner: "broker" as const,
  },
});
export function coverageRules(
  legacy: Rule[],
  version = COVERAGE_RULE_VERSION,
): Rule[] {
  const selected = ["cgl", "property", "auto", "equipment", "professional"];
  const selectors = selected.map((code) =>
    brokerRule(
      `cover_${code}`,
      `Include ${{ cgl: "CGL / products / completed operations", property: "commercial property / business interruption", auto: "commercial automobile", equipment: "tools / contractors equipment", professional: "E&O / contractors professional liability" }[code]} in this request?`,
      "Coverage selection",
      "boolean",
    ),
  );
  const removed = [
    "vehicle_details",
    "equipment_value",
    "equipment_storage",
    "premises",
    "coverage_request",
  ];
  const common = legacy
    .filter((q) => !removed.includes(q.id))
    .map((q) => ({
      ...q,
      provenance: {
        ...q.provenance,
        version: COVERAGE_RULE_VERSION,
        reference: `UW-COVERAGE-002/${q.id}`,
        source:
          "Internal Ontario contractor intake baseline; broker validation required, not an insurer form",
      },
    }));
  const module = (
    code: string,
    id: string,
    label: string,
    type: Rule["type"] = "text",
  ) =>
    rule(
      id,
      label,
      `${{ cgl: "CGL", property: "Property", auto: "Commercial auto", equipment: "Equipment", professional: "E&O" }[code]} details`,
      type,
      { when: { id: `cover_${code}`, equals: "yes" } },
    );
  const definitions: Rule[] = [
    ...selectors,
    brokerRule(
      "coverage_scope",
      "Explain excluded coverages, any specialist referrals (e.g. cyber, pollution, umbrella), and how discovered exposures were discussed",
      "Coverage selection",
    ),
    rule(
      "effective_date",
      "Requested effective date (YYYY-MM-DD)",
      "Coverage selection",
    ),
    rule(
      "locations",
      "Business locations and ownership / tenancy",
      "Locations",
      "schedule",
    ),
    ...common,
    module(
      "cgl",
      "cgl_limits",
      "Requested CGL limits, deductibles, endorsements and certificate / additional insured requirements",
    ),
    module(
      "cgl",
      "cgl_operations",
      "Operations and revenue by activity, residential/commercial/industrial percentages, products, installation and completed operations",
    ),
    module(
      "cgl",
      "cgl_territories",
      "Sales / work by territory, exports and US exposure, height / depth work and excluded hazardous activities",
    ),
    module(
      "cgl",
      "cgl_contracts",
      "Customer contracts, hold-harmless / indemnity terms and subcontractor insurance controls",
    ),
    module(
      "property",
      "property_schedule",
      "Property and valuation records by location",
      "schedule",
    ),
    module("auto", "vehicle_schedule", "Vehicle schedule", "schedule"),
    module("auto", "driver_schedule", "Driver schedule", "schedule"),
    module(
      "auto",
      "auto_history",
      "Prior auto insurer, policy term, fleet losses / experience, cancellations and requested effective date",
    ),
    module("equipment", "equipment_schedule", "Equipment schedule", "schedule"),
    module(
      "equipment",
      "equipment_value",
      "Total equipment replacement value (CAD)",
      "number",
    ),
    module(
      "equipment",
      "equipment_limit",
      "Requested equipment limit (CAD)",
      "number",
    ),
    module(
      "equipment",
      "equipment_storage",
      "Storage, theft protection, transit and unattended equipment controls",
    ),
    brokerRule(
      "equipment_limit_reason",
      "Explain intentional equipment limit below replacement value and confirm client instructions",
      "Equipment details",
      "text",
      {
        when: { id: "cover_equipment", equals: "yes" },
        conditions: [{ id: "equipment_shortfall", equals: "yes" }],
        dependsOn: ["equipment_value", "equipment_limit"],
      },
    ),
    module(
      "professional",
      "professional_services",
      "Professional services, design responsibility, client types, qualifications and registrations",
    ),
    module(
      "professional",
      "professional_fees",
      "Annual professional fees, largest projects, territories and subcontracted professional work",
    ),
    module(
      "professional",
      "professional_controls",
      "Written contracts, limitation of liability, peer review, quality controls and record retention",
    ),
    module(
      "professional",
      "professional_history",
      "Prior E&O coverage, retroactive date / continuity, claims and known circumstances",
    ),
    module(
      "professional",
      "professional_request",
      "Requested E&O limits, deductible, effective date and contractual requirements",
    ),
    brokerRule(
      "market_review",
      "Target insurer / program, forms and editions checked, supplemental requirements and supporting document checklist. If no market selected, explicitly state common-intake-only.",
      "Market review",
    ),
    brokerRule(
      "market_status",
      "Submission scope after checking target market requirements",
      "Market review",
      "select",
      {
        options: [
          "common intake only - insurer requirements not assessed",
          "selected market requirements reviewed",
        ],
      },
    ),
    brokerRule(
      "market_requirements",
      "Market-specific requirement register (broker-entered; independently check the source and edition)",
      "Market review",
      "schedule",
      {
        when: {
          id: "market_status",
          equals: "selected market requirements reviewed",
        },
      },
    ),
    brokerRule(
      "market_attestation",
      "I reviewed the selected scope, all identified follow-ups and required attachments; no known requirement remains unresolved",
      "Market review",
      "boolean",
    ),
  ];
  const coverageParents = selectors.map((q) => q.id);
  return definitions.map((q) => ({
    ...q,
    ...(version === LATEST_RULE_VERSION
      ? {
          provenance: { ...q.provenance, version },
          ...(q.id === "vehicles"
            ? {
                section: "Commercial auto details",
                when: { id: "cover_auto", equals: "yes" },
              }
            : {}),
        }
      : {}),
    dependsOn: [
      ...(q.dependsOn ?? []),
      ...(["coverage_scope", "market_status", "market_review"].includes(q.id)
        ? coverageParents
        : []),
      ...(q.id === "market_attestation"
        ? definitions.filter((r) => r.id !== q.id).map((r) => r.id)
        : []),
      ...(q.id === "vehicle_schedule" ? ["driver_schedule"] : []),
      ...(q.id === "property_schedule" ? ["locations"] : []),
      ...(q.id === "equipment_value" ? ["equipment_schedule"] : []),
      ...(q.id === "professional_services" ? ["design"] : []),
    ],
  }));
}
export function intakeIssues(s: BusinessState): string[] {
  if (!coverageLed(s.rulesVersion)) return [];
  const out: string[] = [];
  if (
    !["cgl", "property", "auto", "equipment", "professional"].some(
      (c) => s.answers[`cover_${c}`]?.value === "yes",
    )
  )
    out.push("Select at least one requested coverage.");
  if (s.answers.market_attestation?.value !== "yes")
    out.push("Broker market / common-intake review must be confirmed.");
  const date = s.answers.effective_date?.value;
  if (
    date &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      Number.isNaN(Date.parse(date)) ||
      new Date(date).toISOString().slice(0, 10) !== date)
  )
    out.push("Requested effective date must be a valid YYYY-MM-DD date.");
  const rows = (id: string) => {
    try {
      return scheduleRows(s.answers[id]?.value || "[]");
    } catch {
      return [];
    }
  };
  const locations = rows("locations");
  if (s.answers.cover_property?.value === "yes") {
    const props = rows("property_schedule");
    for (const loc of locations)
      if (!props.some((p) => p.location === loc.reference))
        out.push(
          `Location ${loc.reference}: record property coverage requested or explicitly declined.`,
        );
    if (props.length && !props.some((p) => p.insured === "yes"))
      out.push(
        "Property is selected but no location requests property coverage; revise the selection or location decisions.",
      );
    const refs = new Set<string>();
    for (const p of props) {
      if (refs.has(p.location))
        out.push(`Duplicate property location: ${p.location}`);
      refs.add(p.location);
      const loc = locations.find((l) => l.reference === p.location);
      if (!loc)
        out.push(
          `Property location ${p.location || "(blank)"} is not in the location records.`,
        );
      if (p.insured === "no") continue;
      if (
        loc?.tenure === "leased" &&
        p.buildingCover === "yes" &&
        !loc.leaseResponsibilities?.trim()
      )
        out.push(
          "Explain lease responsibility before requesting building cover.",
        );
      if (
        p.buildingCover === "yes" &&
        p.valuationStatus === "external report available" &&
        !s.documents.some(
          (d) =>
            d.id === p.valuationDocument &&
            d.kind === "valuation" &&
            d.reviewedBy,
        )
      )
        out.push(
          `Location ${p.location}: attach and broker-review the referenced external valuation.`,
        );
    }
  }
  if (s.answers.cover_auto?.value === "yes") {
    const vehicles = rows("vehicle_schedule"),
      drivers = rows("driver_schedule");
    const refs = new Set(drivers.map((d) => d.reference));
    const vins = new Set<string>();
    for (const v of vehicles) {
      if (vins.has(v.vin)) out.push("Vehicle VINs must be unique.");
      vins.add(v.vin);
      for (const d of (v.drivers || "").split(",").map((x) => x.trim()))
        if (!refs.has(d))
          out.push(
            `Vehicle ${v.reference}: driver reference ${d || "(blank)"} is missing from the driver schedule.`,
          );
    }
  }
  if (
    s.answers.market_status?.value === "selected market requirements reviewed"
  ) {
    for (const req of rows("market_requirements")) {
      if (
        req.attachmentRequired === "yes" &&
        !s.documents.some((d) => d.id === req.documentId && d.reviewedBy)
      )
        out.push(
          "Market requirement attachment must exist and be broker reviewed.",
        );
      if (
        req.coverage !== "package" &&
        s.answers[`cover_${req.coverage}`]?.value !== "yes"
      )
        out.push(
          `Market requirement refers to an unselected coverage: ${req.coverage}`,
        );
    }
  }
  if (s.answers.cover_equipment?.value === "yes") {
    for (const id of ["equipment_value", "equipment_limit"])
      if (s.answers[id]?.value?.trim() && Number(s.answers[id].value) <= 0)
        out.push(
          "Selected equipment coverage needs a positive replacement value and requested limit.",
        );
    const items = rows("equipment_schedule");
    const total = items.reduce(
      (n, r) => n + Number(r.replacementValue || 0),
      0,
    );
    if (
      s.answers.equipment_value?.value &&
      Math.abs(total - Number(s.answers.equipment_value.value)) > 0.01
    )
      out.push(
        "Equipment schedule values must reconcile to the recorded total replacement value.",
      );
  }
  return out;
}
export function displayAnswer(
  id: string,
  value: string,
  documents: { id: string; name: string }[] = [],
): string {
  if (!SCHEDULES[id]) return value;
  try {
    return scheduleRows(value)
      .map(
        (row, i) =>
          `Record ${i + 1}\n` +
          SCHEDULES[id]
            .filter((f) => scheduleFieldActive(id, f, row) && row[f.id]?.trim())
            .map(
              (f) =>
                `${f.label}: ${f.type === "document" ? (documents.find((d) => d.id === row[f.id])?.name ?? row[f.id]) : row[f.id]}`,
            )
            .join("\n"),
      )
      .join("\n\n");
  } catch {
    return "Invalid structured record - review required";
  }
}

export function answerQualityText(id: string, value: string): string {
  if (!SCHEDULES[id]) return value;
  try {
    return scheduleRows(value)
      .flatMap((row) =>
        SCHEDULES[id]
          .filter((f) => scheduleFieldActive(id, f, row))
          .map((f) => row[f.id] || ""),
      )
      .join(" ");
  } catch {
    return "";
  }
}
