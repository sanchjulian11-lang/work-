# Underwriting Desk

AI-assisted commercial insurance intake and submission preparation for Ontario contractors and trades. Built with Next.js App Router, TypeScript, Supabase Auth/Postgres/Storage, and the OpenAI Responses API. This application lives in its own `insurance-submissions/` directory. The earlier Workflow Studio at the repository root and the ToolTrellis project remain separate.

## Run the fictional demo

Requires Node.js 22+ (tested on Node 24) and npm.

```sh
cd insurance-submissions
npm ci
DEMO_MODE=true npm run dev
```

The demo opens directly as a fictional broker and includes a client-role preview. These are **simulated roles, not authentication**. Data is stored under `/tmp/insurance-submissions-demo`, survives server restarts on the same machine, and may disappear when that machine is replaced. Never put real client data in demo mode. No OpenAI calls or document uploads are permitted in the demo.

The sample **Maple Air HVAC Ltd. (Fictional)** intentionally has missing answers and unverified statements. Complete and verify them to unlock approval. Its dates, amounts, and people are fictional.

## Connected Supabase setup

1. Create a dedicated Supabase project; choose an appropriate region and review your brokerage's data handling requirements. No Supabase project was provisioned by this build.
2. Run `supabase/migrations/202610220001_initial.sql` using the Supabase SQL editor, or your existing CLI migration process against a fresh database. Migration is transactional and intentionally not a repeatedly executable setup script.
3. Copy `.env.example` to `.env.local`; set `DEMO_MODE=false`. Supply the project URL, publishable/anon key compatible with the project, and the server-only service-role key. Never commit `.env.local` or expose the service key with a `NEXT_PUBLIC_` prefix.
4. Export the matching fixtures: `npm run export-seed`.
5. In `.env.local`, temporarily set `SEED_BROKER_EMAIL`, `SEED_CLIENT_EMAIL`, and a strong `SEED_PASSWORD` for **fictional sandbox accounts**. Use non-deliverable example addresses if appropriate for your test environment. Run `npm run seed`. It uses administrative Auth provisioning with email confirmation pre-set and does not send email. The bootstrap refuses a database with existing organizations; partial bootstrap failures require administrative inspection, not blind retries.
6. Remove seed variables afterwards. Sign in with the broker or client credentials. There is no public signup or automatic invitation sender. Provision additional users through your organization's administrator; insert their authoritative organization/role membership via a trusted administrative process. Each user belongs to one organization in this MVP. Brokers can assign existing client members to an application on Business profile.
7. Test upload, download, client assignment, session refresh, and broker export using fictional documents against the live Supabase service before production use. These network integrations require credentials and have not been exercised against a hosted project here.

## OpenAI setup and grounding

Set a server-only `OPENAI_API_KEY`, optionally `OPENAI_MODEL` (default `gpt-4.1-mini`), and explicitly set `AI_PROCESSING_ENABLED=true` after authorizing the provider integration. The rules-based summary remains available without AI.

AI is intentionally constrained: the request contains **question identifiers and labels**, eligible coverage codes, and outstanding-question identifiers. No client answer text, business name, document bytes, or email address is sent. The response is a strict reference-only JSON plan: ordering verified facts and choosing from permitted coverage considerations. Reference validation rejects invented or unverified facts and unrelated questions. Actual summary values are rendered deterministically from stored answers, never supplied by the model. This is an AI-assisted structured summary, not unrestricted AI prose or document extraction. Requests use `store:false`; this is not a claim of zero retention by the provider. API errors do not silently become claimed AI successes.

## Workflow

1. Create an Ontario business profile; select HVAC, electrical, plumbing, or general contracting.
2. Record client statements or broker-recorded answers. Each captures actor, timestamp, question ID, rule version, and source type. Blank stays unknown. Conditional children appear only for applicable operations.
3. Brokers verify individual recorded statements. Verification means broker review, **not independent proof**. Editing an answer revokes its verification and dependent verifications.
4. Upload private PDF/JPEG/PNG evidence (4 MB maximum), then record broker document review. When claims are reported, a reviewed loss record and loss details are required.
5. Review missing answers, verification, incomplete placeholders, revenue split totals, and document requirements. These are internal starter intake checks, not exhaustive insurer requirements.
6. Prepare a rules-based or AI-assisted draft. The summary separates verified recorded statements from inferred coverage considerations and outstanding items.
7. Broker explicitly acknowledges review and approves the current draft/revision. Changes to answers, profile, assignments, documents, or draft invalidate approval.
8. Generate a Markdown market-facing submission only after approval. The server checks the digest, revision, and completeness again and stores an immutable snapshot before returning an attachment. Files are downloaded for the broker's manual handling. Nothing is emailed or sent to insurers.

## Security and history

- Production authentication uses Supabase password sign-in, server-validated `getUser()`, and cookie refresh in Next.js proxy. Membership roles come from Postgres, not editable user metadata.
- Organization-scoped RLS protects business data. Clients read only assigned intake via a redacted view; broker drafts, approval data, audit records, full revision history, and final snapshots are unavailable to clients.
- Browser database roles have no write grants. Server-only, service-role RPCs enforce tenant/actor scope and atomic compare-and-swap against the full previous state. Domain validation lives in the Next.js server; possession of the service key is administrative authority, so protect it.
- Each state change and its audit event commit atomically. Published rules, complete business revisions, audit records, and final snapshots are append-only. Revisions retain answer history, including previous source and verification details.
- Private Storage has no browser policies. Uploads go through authenticated server actions, validate size/extension/signature, use random object paths, store SHA-256 hashes, and never overwrite objects. If database metadata persistence fails, uploaded bytes are removed where possible. Admins should reconcile orphan objects after infrastructure outages.
- Download authorization is checked again, recorded in audit, then a 60-second attachment-only signed URL is issued. Signed links are bearer access for their short lifetime. Audit records represent requests, not proof a file was read.
- Same-origin actions, explicit export origin checks, restrictive response headers, escaped React text, and no client credentials in logs. Audit details contain identifiers, not answer text or file contents.
- Application uploads are capped at 4 MiB to leave room below serverless request limits; the private Storage bucket may retain its higher 10 MiB ceiling. Magic-byte checks are **not malware scanning**. Before live rollout, add the brokerage's malware-scanning/quarantine process, retention/deletion policies, monitoring, recovery, and deployment-specific security review. The app has no automated OCR, insurer-specific supplements, market appetite import, PDF export, MFA enrollment UI, or email sender. Identity recovery and MFA require a separately configured identity workflow; this MVP does not implement an in-app enrollment or challenge flow.

## Versioned rules

`src/lib/rules.ts` contains immutable published version `ontario-contractors-2026.10.22-v1`, with per-question provenance and applicability. `supabase/fixture.json` contains the same library for database seeding. These rules are an internal starter specification, not sourced from insurer forms or represented as insurer-approved. Have a qualified broker validate and expand them. New rules need a new version, preserved old code definitions, a new database row, explicit application migration, and fresh review. The app refuses unknown versions and mismatches between the immutable database rule library and the packaged definitions rather than silently using changed rules. Insurer acceptance, coverage suitability, and binding remain broker/market decisions.

## Verification

```sh
npm run typecheck
npm test
npm run test:e2e
npm run build
```

Domain tests exercise conditional questions, missing information, source separation, client/tenant access, approval invalidation, tampering, and uploads. AI tests mock the API and verify minimal inputs and rejected references. Database tests execute the actual migration in PGlite PostgreSQL with test Auth/Storage schemas, then exercise RLS, privileges, transactions, and immutable history. This does not simulate hosted Auth or Storage HTTP services. Playwright uses Chromium (`CHROMIUM_PATH`, default `/usr/bin/chromium`) and starts an isolated fictional demo on port 3100. Install a compatible Chromium locally if needed; browser binaries are not bundled.

For production: `npm run build` then `DEMO_MODE=false npm start`. Configure secrets in the host's secure settings and use HTTPS. A fictional Supabase sandbox has been connected and its Auth, role policies, and broker dashboard verified. OpenAI is not configured, and Vercel deployment is pending.

Hosted-service verification steps are listed in [docs/CONNECTED-ACCEPTANCE.md](docs/CONNECTED-ACCEPTANCE.md).

For deployment configuration, follow [docs/VERCEL-DEPLOYMENT.md](docs/VERCEL-DEPLOYMENT.md).
