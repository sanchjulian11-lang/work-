# Vercel test deployment

The Next.js application lives in `insurance-submissions` inside the `work-` repository. The existing root-level Workflow Studio remains separate.

## Import settings

- Repository: `sanchjulian11-lang/work-`
- Branch: `main`
- Root Directory: `insurance-submissions` (not the repository root)
- Framework Preset: Next.js
- Build Command: `npm run build`
- Install Command: `npm ci`
- Output Directory: leave the Next.js default
- Node.js: 24.x, matching the verified cloud runtime

## Environment variables

Enter these in Vercel's environment variable editor before deploying. Do not commit them or paste the server key in chat.

- `NEXT_PUBLIC_SUPABASE_URL`: the project's HTTPS URL.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: the project's public publishable key. This application uses the legacy configuration name, but accepts the new publishable key.
- `SUPABASE_SERVICE_ROLE_KEY`: copy the server-only service_role key securely from Supabase. Never prefix it with NEXT_PUBLIC_. The cloud workspace's proxy binding is not a credential to copy into Vercel; use the actual key from Supabase.
- `DEMO_MODE`: `false`.
- `AI_PROCESSING_ENABLED`: `false` initially; rules-based summaries work without OpenAI. Add the server-only OpenAI key and authorize processing separately before enabling AI.

Do not add the cloud-only `NODE_USE_ENV_PROXY` setting or seed credentials to Vercel. Do not run the database migration or seed during a Vercel build; they have already been completed against the sandbox project.

## Hosting considerations

Application uploads are limited to 4 MiB, with a 4.25 MiB Server Action envelope, to leave multipart headroom beneath serverless request limits. The existing private Supabase bucket can retain its 10 MiB storage ceiling; the application's lower limit governs uploads through this UI. Larger document uploads need a separately designed direct-to-storage/quarantine flow.

Deploy only fictional data until hosted acceptance checks pass. After deployment, use the generated HTTPS URL to sign in with the broker account. Configure the final HTTPS URL in Supabase Authentication's URL settings before enabling any email-link or redirect-based authentication flows. Password sign-in does not depend on an email callback.

Verify sign-in, broker/client isolation, a small fictional PDF upload and download, verification, approval, and manual export on the actual Vercel host. Vercel credentials and provider access are not supplied by the cloud workspace. An uploaded Git repository is not proof of a successful Vercel deployment.
