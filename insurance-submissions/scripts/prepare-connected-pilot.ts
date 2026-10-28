import { createClient } from "@supabase/supabase-js";
import { randomBytes, randomUUID } from "node:crypto";
import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { verifyStaging } from "./verify-staging.mjs";
import { pilot, completePilot } from "../tests/workflow-fixture";
import { rulesFor } from "../src/lib/rules";

const target = verifyStaging(process.env);
if (!target.local)
  throw new Error("This bootstrap only permits the isolated local stack");
const output = process.env.CONNECTED_FIXTURE_FILE;
if (!output || !output.startsWith("/tmp/"))
  throw new Error("Use a private temporary fixture path");
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
function checked<T extends { error: unknown }>(result: T): Omit<T, "error"> {
  if (result.error)
    throw new Error(
      "Fictional staging provision failed: " + JSON.stringify(result.error),
    );
  return result;
}
const run = randomBytes(5).toString("hex"),
  password = "Fictional-" + randomBytes(24).toString("base64url") + "!4a";
const brokerEmail = `hvac-broker-${run}@example.test`,
  clientEmail = `hvac-client-${run}@example.test`,
  otherEmail = `other-broker-${run}@example.test`;
const broker = checked(
  await admin.auth.admin.createUser({
    email: brokerEmail,
    password,
    email_confirm: true,
  }),
).data.user!;
const other = checked(
  await admin.auth.admin.createUser({
    email: otherEmail,
    password,
    email_confirm: true,
  }),
).data.user!;
const org = randomUUID(),
  otherOrg = randomUUID();
checked(
  await admin.from("organizations").insert([
    { id: org, name: "Fictional HVAC Staging Brokerage" },
    { id: otherOrg, name: "Fictional Other Staging Brokerage" },
  ]),
);
checked(
  await admin.from("memberships").insert([
    { user_id: broker.id, organization_id: org, role: "broker" },
    { user_id: other.id, organization_id: otherOrg, role: "broker" },
  ]),
);
const s = pilot();
s.id = randomUUID();
s.organizationId = org;
s.assignedClientIds = [];
s.revision = 1;
for (const answer of Object.values(s.answers)) answer.recordedBy = broker.id;
checked(
  await admin.from("industry_rules").upsert(
    {
      version: s.rulesVersion,
      industry: "commercial",
      provenance: "Fictional staging; internal common intake only",
      rules: rulesFor(s),
    },
    { onConflict: "version", ignoreDuplicates: true },
  ),
);
checked(
  await admin.rpc("create_business", { p_actor_id: broker.id, p_state: s }),
);
const values = Object.fromEntries(
  Object.entries(completePilot().answers).map(([id, a]) => [id, a.value]),
);
Object.assign(values, {
  years: "6",
  revenue: "250000",
  payroll: "90000",
  employees: "2",
  operations:
    "FICTIONAL TEST: Ontario residential HVAC maintenance and repair only; no installation or design.",
  ownership: "FICTIONAL TEST: Julian Example is the sole shareholder.",
  current_insurance:
    "FICTIONAL TEST: Previously uninsured business requesting its first CGL quote.",
  cgl_limits:
    "FICTIONAL TEST: Request $2 million CGL; $1,000 deductible for broker review.",
  coverage_scope:
    "FICTIONAL TEST: CGL only. No commercial auto, property, equipment or E&O requested.",
});
await mkdir(dirname(output), { recursive: true, mode: 0o700 });
await writeFile(
  output,
  JSON.stringify({
    id: s.id,
    brokerEmail,
    clientEmail,
    otherEmail,
    password,
    values,
  }),
  { mode: 0o600 },
);
console.log(
  "Provisioned a fictional CGL-only application and two isolated broker identities. Client signup will use captured email only.",
);
