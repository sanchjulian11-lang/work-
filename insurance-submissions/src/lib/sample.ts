import { RULE_VERSION } from "./rules";
import type { Actor, BusinessState } from "./types";
export const DEMO_BROKER: Actor = {
  id: "00000000-0000-4000-8000-000000000002",
  organizationId: "00000000-0000-4000-8000-000000000001",
  role: "broker",
  name: "Alex Morgan · fictional broker",
};
export const DEMO_CLIENT: Actor = {
  id: "00000000-0000-4000-8000-000000000003",
  organizationId: DEMO_BROKER.organizationId,
  role: "client",
  name: "Jamie Chen · fictional client",
};
export function sampleBusiness(): BusinessState {
  const values: Record<string, string> = {
    operations:
      "Residential and light commercial HVAC installation, maintenance, and service.",
    years: "6",
    territory: "Ontario only; local service within 100 km of London.",
    experience:
      "Fictional principal has 12 years HVAC experience; licensing evidence not yet supplied.",
    revenue: "750000",
    revenue_split:
      "60% residential service, 20% residential installation, 20% commercial service.",
    payroll: "260000",
    employees: "4",
    subcontractors: "yes",
    subcontract_cost: "90000",
    hot_work: "yes",
    design: "no",
    demolition: "no",
    refrigerants: "yes",
    vehicles: "yes",
    equipment_value: "85000",
    equipment_storage: "Tools stored in a locked unit overnight; vans alarmed.",
    premises:
      "Leased 1,500 sq ft workshop in London, Ontario. Construction and protection details pending.",
    current_insurance:
      "Fictional existing CGL policy; expiry, limits, and deductibles not confirmed.",
    claims: "no",
    coverage_request:
      "Discuss CGL, equipment, and auto; limits and effective date not yet confirmed.",
  };
  return {
    id: "00000000-0000-4000-8000-000000000010",
    organizationId: DEMO_BROKER.organizationId,
    assignedClientIds: [DEMO_CLIENT.id],
    revision: 1,
    rulesVersion: RULE_VERSION,
    fictional: true,
    profile: {
      legalName: "Maple Air HVAC Ltd. (Fictional)",
      operatingName: "Maple Air",
      city: "London",
      province: "ON",
      industry: "hvac",
      description: "Fictional HVAC contractor account for testing only.",
    },
    answers: Object.fromEntries(
      Object.entries(values).map(([id, value]) => [
        id,
        {
          value,
          source: "client_statement" as const,
          recordedBy: DEMO_CLIENT.id,
          recordedAt: "2026-10-22T12:00:00.000Z",
          questionVersion: RULE_VERSION,
        },
      ]),
    ),
    documents: [],
  };
}
