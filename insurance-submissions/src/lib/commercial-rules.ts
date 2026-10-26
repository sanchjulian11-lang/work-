import { COMMERCIAL_RULE_VERSION, coverageRules } from "./coverage-intake";
import type { Profile, Rule } from "./types";

const trades: Profile["industry"][] = [
  "hvac",
  "electrical",
  "plumbing",
  "general",
];
const contractorOnly = new Set([
  "experience",
  "revenue_split",
  "subcontractors",
  "subcontract_cost",
  "subcontract_controls",
  "hot_work",
  "hot_work_controls",
  "design",
  "design_details",
  "demolition",
  "demolition_details",
  "refrigerants",
  "refrigerant_controls",
  "electrical_scope",
  "plumbing_scope",
  "vehicles",
]);
const source =
  "Internal Ontario commercial intake draft; class and insurer validation required";
function classQuestion(
  id: string,
  label: string,
  industry: Profile["industry"],
  type: Rule["type"] = "text",
  when?: Rule["when"],
): Rule {
  return {
    id,
    label,
    section: "Business activities",
    type,
    required: true,
    industries: [industry],
    ...(when ? { when, dependsOn: [when.id] } : {}),
    provenance: {
      source,
      reference: `UW-COMMERCIAL-DRAFT/${id}`,
      version: COMMERCIAL_RULE_VERSION,
      owner: "client",
    },
  };
}
export function commercialRules(legacy: Rule[]): Rule[] {
  const base = coverageRules(legacy, COMMERCIAL_RULE_VERSION).map((q) => ({
    ...q,
    ...(contractorOnly.has(q.id) ? { industries: q.industries ?? trades } : {}),
    provenance: {
      ...q.provenance,
      source,
      version: COMMERCIAL_RULE_VERSION,
      reference: `UW-COMMERCIAL-DRAFT/${q.id}`,
    },
    ...(q.id === "cgl_operations"
      ? {
          label:
            "Operations and revenue by activity; products, services, premises, sales channels and completed work where relevant",
        }
      : {}),
    ...(q.id === "cgl_territories"
      ? {
          label:
            "Sales and work territories, exports, US exposure and hazardous activities where relevant",
        }
      : {}),
    ...(q.id === "cover_professional"
      ? { label: "Include professional liability / E&O in this request?" }
      : {}),
    ...(q.id === "cover_equipment"
      ? {
          label: "Include tools or movable equipment coverage in this request?",
        }
      : {}),
  }));
  return [
    ...base,
    classQuestion(
      "service_revenue_split",
      "Annual revenue breakdown by service and client sector (percentages must total 100%)",
      "professional_services",
    ),
    classQuestion(
      "service_qualifications",
      "Services offered, professional qualifications, licences or registrations, and who performs the work",
      "professional_services",
    ),
    classQuestion(
      "service_contracts",
      "Written engagements, deliverables, subcontracted professional work, and quality controls",
      "professional_services",
    ),
    classQuestion(
      "retail_product_mix",
      "Products and sales by category, including online sales and geographic territories",
      "retail",
    ),
    classQuestion(
      "retail_revenue_split",
      "Annual revenue by product category and sales channel (percentages must total 100%)",
      "retail",
    ),
    classQuestion(
      "retail_imports",
      "Do you import, manufacture, relabel or alter products?",
      "retail",
      "boolean",
    ),
    classQuestion(
      "retail_import_details",
      "Products, countries of origin, quality controls and responsibility for product labels",
      "retail",
      "text",
      { id: "retail_imports", equals: "yes" },
    ),
    classQuestion(
      "rental_occupancies",
      "Property type, number of units, tenant mix and occupancy at each location",
      "rental_property",
    ),
    classQuestion(
      "rental_management",
      "Owner, property manager, maintenance responsibility, inspections and lease arrangements",
      "rental_property",
    ),
    classQuestion(
      "rental_income",
      "Annual rental income by location and any requested loss-of-rents period",
      "rental_property",
    ),
    classQuestion(
      "rental_short_term",
      "Are any units rented short term or through a home-sharing platform?",
      "rental_property",
      "boolean",
    ),
    classQuestion(
      "rental_short_term_details",
      "Booking method, stay length, guest turnover, supervision and manager contact",
      "rental_property",
      "text",
      { id: "rental_short_term", equals: "yes" },
    ),
  ];
}
