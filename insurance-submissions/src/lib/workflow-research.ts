// Context for the first workflow pilot, separate from immutable questionnaire definitions.
// Public availability does not establish current Ontario acceptance or field universality.
export const PILOT_RESEARCH = {
  reviewed: "2026-10-27",
  scope:
    "Ontario HVAC service/repair, CGL-only workflow pilot. Existing questionnaire wording remains an internal common-intake draft; this release does not implement a fully validated insurer application.",
  limitation:
    "Public sources were compared on 27 October 2026. Current accepted Ontario editions, capacity and applicability remain unconfirmed. Individual carrier fields and attachments are not universal requirements. Full commercial-auto applications were not validated in this research.",
  sources: [
    {
      title: "Cansure — Contractors Liability",
      edition: "A028.1 (12/17)",
      url: "https://cansure.com/wp-content/uploads/2021/09/Contractors-Liability-Application.pdf",
    },
    {
      title: "Cansure — Plumbing & HVAC Contractors",
      edition: "A157.2 (06/21)",
      url: "https://cansure.com/wp-content/uploads/2021/09/Plumbing-and-HVAC-Contractor-Application.pdf",
    },
    {
      title: "Markel Canada — Contractors",
      edition: "CONTRACTORS; footer 103112 (edition date unconfirmed)",
      url: "https://content.markel.com/api/public/content/contractors-application",
    },
  ],
} as const;
