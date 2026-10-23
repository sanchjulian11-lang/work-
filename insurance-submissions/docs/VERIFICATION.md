# Build verification — October 22, 2026

- Clean `npm ci`: passed.
- `npm run typecheck`: passed (Next route generation and strict TypeScript).
- `npm test`: 33 tests passed across domain, mocked OpenAI boundary, and real PostgreSQL migration/RLS tests using PGlite.
- `npm run test:e2e`: 2 Chromium browser workflows passed, including a full approval/export cycle and approval revocation after editing an answer.
- `npm run build`: passed with all application routes and the authentication cookie-refresh proxy.
- Production browser smoke: passed for overview, security headers (no eval in production), conditional questionnaire, demo role restrictions, mobile width, rejection of an unapproved export, and no browser errors.
- `npm audit --omit=dev --audit-level=high`: zero reported vulnerabilities at verification time.

## Not verified / not performed

No Supabase project or OpenAI credentials were available. Hosted password authentication, session refresh against hosted Auth, actual private Storage uploads/downloads, and a live OpenAI call were not exercised. OpenAI tests use a mock; PostgreSQL tests emulate Supabase Auth/Storage schemas but execute the real SQL migration and role policies. Demo role switching is not authentication. The production smoke used the explicit fictional demo mode.

No deployment, email sending, insurer transmission, or real-client processing occurred. See CONNECTED-ACCEPTANCE.md for the remaining hosted-service checks and operational controls.

## Connected sandbox follow-up

The user supplied Supabase credentials securely and created the broker identity. Setup assigned its broker role, published the matching starter rules, created a fictional client identity, and loaded the fictional HVAC application through audited RPCs. Hosted Auth verification sessions, broker business access, the assigned-client redacted view, client audit isolation, denied client mutations, and the real authenticated broker dashboard passed. Temporary verification sessions were closed. No passwords were changed and no emails were sent. Actual document-byte upload/download, OpenAI requests, and the final Vercel-hosted workflow remain unverified.

## Deployment-source verification

The application was copied into the existing GitHub repository as `insurance-submissions/`, excluding private environment files and generated dependencies. The request upload limit was lowered to 4 MiB with a 4.25 MiB Server Action envelope. Clean dependency installation, TypeScript, 33 tests, and the production build passed from that deployment directory. This is source/build verification, not a Vercel deployment result.
