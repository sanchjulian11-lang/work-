import { pathToFileURL } from "node:url";

// This branch's Vercel build must never inherit the existing application's DB.
const existingProject = "bhxxrzblghgtytimthqw";

/** @param {Record<string, string | undefined>} env */
export function verifyStaging(env) {
  const fail = (message) => {
    throw new Error(`Staging isolation check: ${message}`);
  };
  if (env.APP_ENV !== "staging") fail("APP_ENV must be staging");
  if (env.DEMO_MODE !== "false")
    fail("connected staging requires DEMO_MODE=false");
  if (env.AI_PROCESSING_ENABLED !== "false") fail("AI must remain disabled");
  const ref = env.STAGING_SUPABASE_PROJECT_REF;
  if (!ref || ref === existingProject)
    fail("a separate test Supabase project is required");
  let url;
  try {
    url = new URL(env.NEXT_PUBLIC_SUPABASE_URL ?? "");
  } catch {
    fail("configure the test Supabase URL");
  }
  const local = ["127.0.0.1", "localhost"].includes(url.hostname);
  if (
    local
      ? ref !== "local-staging"
      : url.protocol !== "https:" || url.hostname !== `${ref}.supabase.co`
  )
    fail("Supabase URL does not match the pinned test project");
  if (!env.NEXT_PUBLIC_SUPABASE_ANON_KEY || !env.SUPABASE_SERVICE_ROLE_KEY)
    fail("test-project credentials are missing");
  if (env.VERCEL === "1") {
    if (local) fail("Vercel requires a separate hosted test database");
    if (
      !env.STAGING_VERCEL_PROJECT_ID ||
      env.VERCEL_PROJECT_ID !== env.STAGING_VERCEL_PROJECT_ID
    )
      fail("Vercel project does not match the pinned staging project");
  }
  // Legacy JWT keys can be checked without printing their contents. New opaque
  // Supabase keys remain supported and are checked by the pinned project's API.
  for (const key of [
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  ]) {
    const parts = env[key].split(".");
    if (parts.length !== 3) continue;
    let claims;
    try {
      claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    } catch {
      fail("invalid test credential format");
    }
    if (claims.ref && claims.ref !== ref)
      fail("credential belongs to a different Supabase project");
    if (key === "SUPABASE_SERVICE_ROLE_KEY" && claims.role !== "service_role")
      fail("server credential has the wrong role");
  }
  return { projectRef: ref, local };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    verifyStaging(process.env);
    console.log("Staging isolation checks passed.");
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
