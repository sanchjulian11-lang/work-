import { writeFile } from "node:fs/promises";
import { sampleBusiness } from "../src/lib/sample";
import { CONTRACTOR_RULES } from "../src/lib/rules";
await writeFile(
  "supabase/fixture.json",
  JSON.stringify(
    { business: sampleBusiness(), rules: CONTRACTOR_RULES },
    null,
    2,
  ) + "\n",
);
console.log("Exported fictional fixture and versioned rules.");
