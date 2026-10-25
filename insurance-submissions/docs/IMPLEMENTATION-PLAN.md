# Ontario standalone submission platform

Authorized direction (2026-10-25): implement and deploy incrementally. No Applied
Epic integration. Broker downloads, reviews and manually sends submissions, then
handles client setup in Epic independently.

## Delivery sequence

1. Historical questionnaire protection: editors, schedule validation, quality
   checks and exports consume each published rule's scheduleFields. Published
   v1/v2/v3 definitions and hashes must remain unchanged. Shared schedule
   templates are only definition-building inputs, not runtime authority. Future
   versions must retain the old templates and behaviours explicitly.
2. Source-backed class library: separate common business information, activities,
   requested coverage and market supplements. Start with contractors, professional
   services, retail and rental property; mixed activities require explicit support.
   Do not relabel contractor questionnaires as generic commercial questionnaires.
3. Market research register: retain workbook filename, sheet, cell, original
   text, market identity, class, condition, date evidence and confirmation status.
   Historical notes must never become current automated decline/accept rules.
   A blank cell means no guidance recorded. Do not publish the proprietary
   workbook or its contact details in repository assets or public bundles.
4. Submission package: structured requested terms, relevant schedules, approved
   PDF, supporting-document manifest and immutable artifact hashes. A summary is
   not a substitute for a selected market's required application.
5. Prospect workflow: separate accounts/contacts/prospects from applications;
   record sources and qualification, then broker-led discovery and client intake.
   No paid data subscription, automatic outreach or insurer sending is enabled
   merely by authorizing implementation and deployment.
6. Document extraction pilot: proposals with source page references; acceptance
   and verification remain explicit. Evaluate actual document accuracy before
   enabling extraction on real client material.

## Source limitations

The uploaded appetite workbook contains 31 worksheets and 471 populated
class/topic headings including duplicates and cross references. Notes span
2016–2026. Its 12 linked application/document paths are not embedded documents.
The source provides research leads, not proof of current market appetite or
exhaustive underwriting requirements. Current application forms and broker
validation remain required before publishing market-specific readiness checks.

## Acceptance criteria for new class releases

- Existing applications retain definitions and validation appropriate to their
  version. No silent migration or carried-forward approval.
- CGL-only risks do not receive full commercial-auto schedules by default.
- Tenanted premises distinguish building responsibility from contents and
  improvements. Multiple locations remain separately identifiable.
- Professional services and retail use class-specific facts rather than trade
  licences or construction-specific questions without an applicable exposure.
- Unknown, not requested, no and not applicable remain distinguishable.
- An answer change invalidates affected verification and final approval.
- Insurer-specific requirements have a reviewed source/edition and explicit
  applicability. Common intake readiness is labelled separately.
- Cross-tenant access, client/broker permissions, save conflicts, document access,
  approval revocation and final export are tested before release.

## First implementation increment

Pinned schedule fields now drive forms, verification, completeness checks and
export rendering. Rule construction copies schedule templates so later template
mutation cannot alter already-created rule definitions. This does not add new
business classes or independently validate insurer requirements. Domain-specific
cross-record logic is still code-versioned and must be preserved when future
rulesets change its semantics.
