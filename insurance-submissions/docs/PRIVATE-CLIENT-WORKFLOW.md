# First private client-to-broker workflow

Prepared 27 October 2026 (America/Toronto). Local review increment; no invitations sent, live records imported, changes pushed or deployment performed.

## Scope and review paths

The pilot uses fictional Ontario HVAC service/repair with CGL selected and property, commercial auto, equipment and E&O declined. This increment adds the client handoff around existing pinned questionnaires; it does not certify their underwriting completeness or implement all research recommendations.

1. A broker opens **Client intake queue** (`/review`) and creates a fictional HVAC CGL pilot, or opens **Guided intake** for an existing application.
2. Under **Private client invitation**, create a link for a recipient and an expiry of 1–14 days. Copy it once and share through a separately approved channel. Creating a link sends no email. Local tests use `client@fictional.example` only.
3. `/invite#token=…` requires a confirmed identity matching the recipient. New users can create an account and confirm its email through Supabase Auth; existing users sign in. Account verification is separate from application authorization. Claiming assigns only the invited application.
4. The client completes four stages, returns using the private application URL, and sees acknowledged saved answers. Unknown and Not available yet are explicit answer states. Partial or invalid input remains durable and visibly incomplete. The current step is retained in the URL.
5. **Submit to broker** records an immutable-in-history receipt with the submitted revision and gap list. Missing information does not block this preliminary handoff. Later edits do not rewrite the earlier receipt.
6. The broker queue distinguishes drafts, submissions, changes requested and responses to review. Ask a clarification under its related question. The client sends a response; the broker records its resolution. A response does not change or verify the underlying answer automatically.
7. Use the existing broker questionnaire to verify recorded statements and review documents, then prepare a current draft and approve that exact revision. Unknowns, invalid drafts, unresolved clarification requests and existing completeness failures block approval. Workflow changes invalidate prior approval; subsequent exports require fresh review.

Client profile/coverage corrections still go through the broker. The guided screen clearly says this; client-controlled legal identity edits and additional risk packs are outside this increment. Uploads use the existing private Documents screen and download controls. They are not attached to clarification records or bundled into the PDF.

## Security and persistence

- Invitations contain 256-bit random tokens. Only SHA-256 hashes are persisted. Raw tokens are shown once to the creating broker and carried in URL fragments, outside ordinary GET URLs/referrers. Treat the full link as confidential.
- Claiming is atomic: the service-only PostgreSQL function rechecks confirmed email, recipient, expiry, revocation, unused status and organization membership while locking the invitation. It creates a client membership only if absent, never converts an existing broker role or moves another organization's account.
- Existing architecture permits one organization membership per identity. Invitations for an identity belonging to another organization are rejected. Multi-brokerage identity support is a separate design change.
- Revocation prevents an unclaimed link from working. For claimed access, remove the client assignment in Business profile. Other pending links must also be revoked if all future claim paths are to be closed.
- Browser roles cannot read/write invitation rows or execute invitation mutation RPCs. Server actions derive identity from authenticated sessions, check origin, authorize the application and return a restricted intake view. Assignment and tenant boundaries remain enforced on every load/mutation.
- Production saves use the existing expected-state, row-locked commit RPC and append-only revision/audit history. `intake` is optional additive state; old applications do not require migration to a new questionnaire version.
- Autosaves are serialized and acknowledged by the server. A conflict or failed connection pauses saves, retains the local draft and requires loading the latest state before an explicit retry or discard. An older answer cannot be verified while its invalid replacement draft is outstanding.
- Only acknowledged saves are durable across closing a tab. Unsaved offline edits remain in that open tab with a navigation warning; they are deliberately not written to browser local storage. This is not an offline-first application.
- Demo identities/filesystem persistence are test adapters, not production authentication or multi-instance storage. Keep `DEMO_MODE=false` for connected staging/production.

The additive migration is [202610270001_client_workflow.sql](../supabase/migrations/202610270001_client_workflow.sql). It has been exercised locally against PostgreSQL via PGlite, not applied to a hosted project. Existing rule definitions and historical states are not rewritten. Invitation audit metadata excludes tokens, hashes and recipient email.

## PDF and research limits

The v5 overview and PDF now use the same scope: **Broker-reviewed common intake; insurer-specific requirements not assessed**. Legacy market fields are not printed as contradictory scope values in v5. Coverage considerations use general liability/products/completed-work language, **Tools / movable equipment**, and **Professional liability / E&O**, rather than contractor terminology for every business class. The PDF still separates reviewed facts from inferences, includes provenance/approval identifiers and explains that indexed supporting files must be attached separately. A common-intake PDF does not replace an insurer's application, declaration or supplemental.

The primary-source review and its evidence matrix are retained under [research/2026-10-27](research/2026-10-27/CROSS-PUBLISHER-REVIEW.md). Its two publishers are Cansure and Markel Canada; eighteen PDFs do not mean eighteen independent insurers. Public availability is not proof of current Ontario program acceptance. Relevant pilot context includes:

| Source                              | Printed edition/code       | Applicability limit                                                                       |
| ----------------------------------- | -------------------------- | ----------------------------------------------------------------------------------------- |
| Cansure Contractors Liability       | A028.1 (12/17)             | Older public contractor form; confirm current accepted edition                            |
| Cansure Plumbing & HVAC Contractors | A157.2 (06/21)             | Trade supplement; source-specific attachments/thresholds are not universal                |
| Markel Canada Contractors           | CONTRACTORS; footer 103112 | Footer is not a confirmed edition date; current Ontario program applicability unconfirmed |

The broker's guided page exposes these references and limitations. Existing v5 questions retain their internal provenance. No question has been relabelled as a verified universal insurer requirement. Detailed auto source gaps remain; the CGL-only pilot hides full VIN/driver schedules. The SBU log was used for priority context only; its live rows were not imported or converted into requirements.

## Larger-business extension points

Workflow records reference stable application IDs, question IDs, request IDs and revisions, rather than one display name, trade label or address string. They operate over active rules and existing repeatable location/coverage schedules. Location links retain their existing generated IDs. Clarifications are a list, not a single global comment/status field.

Keep future insured entities, activities and schedule records as versioned collections with stable IDs and explicit relationships. Add record/field context to clarification requests where necessary; use new questionnaire versions when changing questions or branching. Do not expand the existing single legal-name profile into a large-business model by overwriting historical records. This release does not claim to support multi-entity placement yet.

## Verification and release boundary

Local results for this review increment:

| Check                                                                       | Result                                                                    |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Type checking                                                               | Passed; production build also rechecked TypeScript after the final UI fix |
| Unit / PostgreSQL / PDF suite                                               | 129 passed across 12 files                                                |
| Full browser acceptance suite                                               | 8 passed                                                                  |
| New private-workflow browser scenarios after clarification retry protection | Both passed, including failed-send text retention and retry               |
| Optimized production build                                                  | Passed; `/invite`, `/intake/[id]` and `/review` are dynamic routes        |
| Whitespace / patch validation                                               | `git diff --check` passed                                                 |
| Hosted Supabase / delivery / deployment                                     | Not run; awaiting an approved staging release                             |

Automated coverage includes token expiry/revocation/reuse, confirmed-email and tenant boundaries, new membership claim, preserved historical revisions, durable answered/unknown/invalid input, partial handoff receipts, clarification resolution, client/broker conflict rejection, network recovery, approval invalidation and text extracted from a real generated PDF. Browser tests use separate fictional identities and temporary storage. Existing acceptance tests remain in the suite.

Local commands:

```sh
npm run typecheck
npm test
npm run test:e2e
npm run build
```

PDF-content tests require Poppler's `pdftotext`, installed in this environment. No new application dependency was added.

Before a real-client pilot, an explicitly approved staging release still needs hosted Supabase email confirmation/session tests, migration/grant verification, assignment removal and storage checks described in [CONNECTED-ACCEPTANCE.md](CONNECTED-ACCEPTANCE.md). No real email/auth/signup, hosted migration, push or deployment is part of this local verification. Lead finding, outreach, reminder jobs, insurer transmission, Epic integration, document extraction and broad new underwriting packs remain outside this increment.
