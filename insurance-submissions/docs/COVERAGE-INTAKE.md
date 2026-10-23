# Coverage-led contractor intake, version 2

This release is an internal common-intake baseline for Ontario contractors and
trades. It is **not** a verified insurer application, a complete catalogue of
commercial products, a valuation service, or a guarantee of underwriting
acceptance. No insurer forms were available for source validation when this
baseline was written. A broker must validate the questions before real use.

## Implemented scope

- Broker selects any combination of CGL, property, commercial auto, equipment,
  and contractors professional liability / E&O. These selections are not inferred
  from exposure answers. A client cannot change broker-owned coverage or market
  decisions through a crafted server-action request.
- Core business, financial, operations, claims, location, and exposure questions
  remain relevant even where an associated coverage is not requested.
- Only selected coverage modules open. Detailed auto schedules do not open solely
  because the business uses a vehicle. CGL can coexist with property and E&O.
- Location records distinguish ownership, tenancy and other arrangements, and
  record occupancy and lease / ownership insurance responsibilities.
- Property records link to those locations. Every location needs an affirmative
  property decision or an explicit decline. Building requests include construction,
  systems, protection, values, valuation status and basis. An external report must
  be attached by document ID, classified as a valuation, and broker reviewed.
  An outstanding valuation blocks approval. A documented alternative is a broker
  decision, never an AI estimate or an automatically accepted valuation.
- Auto schedules collect vehicles, VINs, ownership, registered owners, use, radius,
  territories, assigned drivers, requested coverage and vehicle value. Driver
  schedules collect licensing, experience, record and abstract status information.
  VIN format and check digits, duplicate VINs and driver references are checked.
- Equipment schedules reconcile to total replacement value. A requested limit
  below that value triggers an explicit broker explanation and client-instruction
  record; the system never silently substitutes either amount.
- Professional liability collects services, qualifications, fees, project size,
  contracts, quality controls, coverage continuity, claims / known circumstances,
  and requested terms.
- Partial schedules may be saved. Required fields, numeric bounds, choices,
  cross-references and pending items block final approval. Invalid schedules
  cannot be verified. Verification is review of statements, not independent proof.
- Coverage/parent changes invalidate dependent verification, drafts and approval.
  Profile changes invalidate all statement verification. Hidden answers are
  retained for history but excluded from the current submission.

## Insurer-specific requirements

No source-verified insurer library ships in this release. The broker explicitly
chooses **common intake only — insurer requirements not assessed**, or records
that a selected market's requirements were reviewed. The latter opens a
requirement register with coverage, requirement, source document/URL, edition,
date checked, status, evidence/basis, and any required attachment reference.
Unresolved requirements and missing/unreviewed referenced attachments block
approval. This is a broker-entered register, not an independent verification that
an insurer's latest requirements have been identified. The chosen scope appears
in the PDF and audit copy.

## Versioning and deployment

Existing applications retain `ontario-contractors-2026.10.22-v1` and their original
approvals. They are never silently reinterpreted. New applications use
`ontario-contractors-2026.10.23-v2`. On creation, the server publishes that exact
immutable rule definition (including schedule fields, conditions and dependencies)
and checks for an exact match before creating the application. No schema change
or destructive migration is required. Rule versions must not be edited after
publication. A subsequent requirement change requires a new version.

From Overview, expand **Create another business profile**. Mark a synthetic
application as fictional. Then open Questionnaire and complete Coverage selection.
Existing client assignment controls apply to every new application.

The user-facing export is now PDF only. Provenance and immutable snapshots remain
available internally; the authenticated legacy Markdown endpoint is retained for
compatibility. Neither export transmits anything to an insurer. Attach reviewed
supporting files separately.

## Known boundaries and next validation work

- Baseline modules remain partly narrative; free-text adequacy requires broker
  review. Detecting placeholder words is not semantic underwriting validation.
- Motor vehicle abstracts, valuation reports and other supporting records are not
  fetched or independently authenticated. VIN validation does not prove ownership
  or verify a vehicle against an external registry. Nonstandard / older VINs need
  a specialist path, which this release does not implement.
- Cyber, standalone pollution, D&O, crime, umbrella/excess, cargo, aviation,
  specialty fleets and other specialist products are referral considerations,
  not implemented complete questionnaires. The scope explanation must identify
  specialist needs or omitted coverage discussions.
- Build an insurer overlay only after obtaining the actual form/program
  requirements, permission to use them, a source/edition record, and broker
  sign-off. Test it against sample submissions and insurer feedback before
  describing it as market-specific completeness.
- Add source-validated industry libraries beyond contractors/trades, formal
  approval of the baseline by a licensed Ontario commercial broker, then
  structured limit/deductible schedules, attachment packaging and renewal flows.
