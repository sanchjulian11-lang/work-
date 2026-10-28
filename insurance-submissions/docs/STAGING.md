# Isolated private-workflow staging

Authorized 27 October 2026 (America/Toronto): publish a separate staging branch and test environment with fictional accounts/records only. Do not deploy to or migrate the existing application/database, import client records, send real invitations, or enable AI/outreach.

Branch: `staging/private-client-workflow-2026-10-27`.

## Hosting isolation

This branch's `vercel.json` disables Git-triggered deployments and requires `scripts/verify-staging.mjs` before a Vercel build. The preflight rejects the existing Supabase project, a mismatched test-project URL or legacy JWT key, missing test credentials, demo filesystem mode, enabled AI, and a Vercel project ID different from the pinned staging project. Five automated tests exercise these checks. The original project's `main` branch is unchanged.

Use a **new Vercel project and separate Supabase test project**, not Preview variables copied from the existing app. Deploy manually to that test project after configuring:

```text
APP_ENV=staging
DEMO_MODE=false
AI_PROCESSING_ENABLED=false
STAGING_SUPABASE_PROJECT_REF=<new test project reference>
STAGING_VERCEL_PROJECT_ID=<new Vercel project ID>
NEXT_PUBLIC_SUPABASE_URL=<matching test project HTTPS URL>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<test project public key>
SUPABASE_SERVICE_ROLE_KEY=<test project server-only key>
```

Do not copy the existing service-key binding into the staging project. Do not merge the branch-specific Vercel configuration into a production release without a separately reviewed release configuration.

Apply both SQL migrations only to the fresh isolated test database. Provision fictional users directly or use a captured email service; do not use real recipients. Confirm `DEMO_MODE=false` before calling connected authentication/storage tests. No live-client seed or automatic application email delivery is required.

## Environment access prerequisites

The cloud environment can access the repository through its injected HTTPS Git proxy. Read-only Git checks passed. The initial calls to `api.github.com`, `api.vercel.com` and `api.supabase.com` were denied at the egress proxy before API authorization.

A configuration draft preserves the existing domain list and adds `api.github.com`, `api.vercel.com`, `vercel.com`, `api.supabase.com` and `supabase.com`. It also requests `VERCEL_TOKEN` for `api.vercel.com` and `SUPABASE_ACCESS_TOKEN` for `api.supabase.com`. Enter those values only in secure environment settings, then save/publish the environment. No token value belongs in chat, Git or this document. These are management credentials for provisioning the test projects; the existing Supabase application key is not a management credential.

Saving the draft does not establish that access is active or that a hosted deployment exists. Verify each API operation after publication. Creating a paid resource or upgrading a subscription is outside this authorization.

## Local connected test stack

An isolated Docker-backed Supabase stack can test actual Auth, PostgreSQL and Storage without changing the existing hosted database. Use a unique project name, a fresh test data volume, a local captured-email service and separate ports. This is distinct from the browser suite's demo identity adapter and from a publicly reachable hosted staging release.

The current local setup uses the official Supabase CLI 2.54.11, downloaded from its GitHub release and checked against the release's SHA-256 checksums. The current CLI 2.122.0 could not start because it tried to create configuration under this environment's read-only home; the older installer also failed to use the egress proxy. Neither TLS nor checksum verification was disabled. Tool installation and stack data remain outside Git.

Follow [CONNECTED-ACCEPTANCE.md](CONNECTED-ACCEPTANCE.md) for the full acceptance criteria. Software test results, branch publication, a running local stack and a hosted staging release must be reported separately.
