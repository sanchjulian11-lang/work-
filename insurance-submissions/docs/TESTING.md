# Automated acceptance checks

Run from `insurance-submissions` with Node 24 and Chromium installed:

The PDF text regression tests also require Poppler's `pdftotext` (for example,
the `poppler-utils` package on Debian/Ubuntu).

```sh
npm ci
npm test
npm run build
npm run test:e2e
```

Playwright uses `/usr/bin/chromium` locally; set `CHROMIUM_PATH` to another
Chromium executable when needed. It starts its own local server on port 3100,
uses DEMO_MODE=true and a new temporary directory of fictional records per run.
It needs no production Supabase or AI credentials. Do not point this suite at
production accounts.

The GitHub workflow `.github/workflows/insurance-checks.yml` runs the unit/database
suite, production build and browser acceptance suite for application changes on
push and pull requests. It also supports manual dispatch. Failed browser runs
retain traces and screenshots for diagnosis, uploaded for seven days. These
artifacts contain fictional data only. GitHub Actions availability and branch
protection are repository settings; this workflow alone does not block Vercel's
independent automatic deployment or establish a required merge check.

## Covered journeys

- Conditional intake and simulated client/broker boundaries.
- Complete review, approval, PDF export and approval revocation after editing.
- Save/verify and validation messages remain at the question.
- CGL/auto selection shows and hides vehicle/driver schedules.
- Locations get automatic references and persist after reload.
- Property decisions link to a saved address; declined property hides details.
- Leased property with contents requested and building declined persists after
  reload, retains valuation-not-applicable, and hides building value.
- Partial property records save but cannot be verified; rejection survives reload.
- Deleting a referenced location shows an unavailable reference rather than
  silently substituting another address. Approval stays blocked.
- Mobile layout and unassigned-client access restrictions.
- Serialized autosaves, draft retention, network failures and stale-session recovery.
- Private invitation claim/reuse/revocation, unassigned access denial, typed unknowns,
  invalid-but-saved numeric drafts, partial submissions, broker queue and a
  question-linked clarification round trip between separate fictional sessions.
- Client/broker concurrent edits pause, preserve drafts and require comparison;
  offline saves cannot report success and can resume after reconnecting.

Unit/domain tests additionally cover schedule checks, immutable rule definitions,
role checks, dependency invalidation, AI reference validation, PDF output and
actual migration/RLS/RPC behaviour through PGlite PostgreSQL.

The workflow tests apply both migrations and additionally check verified-email
claiming, expiry, role/tenant boundaries, new membership assignment, approval
invalidation and preserved revision history. The real PDF-content test extracts
text and checks scope, terminology, hidden auto records and approval provenance.
See [PRIVATE-CLIENT-WORKFLOW.md](PRIVATE-CLIENT-WORKFLOW.md) for the review paths
and current limitations.

## Boundaries

Local browser tests use simulated identities and filesystem demo storage. They
do not establish deployed Supabase Auth/Storage, real email, Vercel networking,
external AI quality or insurer acceptance. A separate hosted staging project,
fictional test identities and reachable endpoints are needed for those tests.
Never use a passing software suite to label unvalidated underwriting requirements
as insurer-approved. Future class modules need source-reviewed example cases and
specific expected outputs before they can be released as supported.
