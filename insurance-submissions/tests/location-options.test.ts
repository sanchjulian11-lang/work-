import type { BusinessState } from "../src/lib/types";
import { it, expect } from "vitest";
import { locationOptions } from "../src/lib/location-options";
import { saveAnswer } from "../src/lib/domain";
import { sampleBusiness, DEMO_BROKER } from "../src/lib/sample";
import { LATEST_RULE_VERSION, displayAnswer } from "../src/lib/coverage-intake";
it("generates references for new locations and preserves them through address edits and row reordering", () => {
  let s: BusinessState = {
    ...sampleBusiness(),
    rulesVersion: LATEST_RULE_VERSION,
    answers: {},
  };
  s = saveAnswer(
    DEMO_BROKER,
    s,
    "locations",
    JSON.stringify([
      { address: "123 Test Street", tenure: "leased" },
      { reference: "LOC-01", address: "456 Old Street", tenure: "owned" },
    ]),
  );
  const rows = JSON.parse(s.answers.locations.value);
  expect(rows[0].reference).toMatch(/^[0-9a-f-]{36}$/);
  expect(rows[1].reference).toBe("LOC-01");
  const first = rows[0].reference;
  rows[0].address = "123 Updated Street";
  s = saveAnswer(
    DEMO_BROKER,
    s,
    "locations",
    JSON.stringify([rows[1], rows[0]]),
  );
  expect(locationOptions(s.answers.locations.value)).toEqual([
    { id: "LOC-01", label: "456 Old Street — Owned" },
    { id: first, label: "123 Updated Street — Leased" },
  ]);
});
it("offers only recorded locations with an address and does not invent a missing address", () => {
  expect(locationOptions("invalid")).toEqual([]);
  expect(
    locationOptions(
      JSON.stringify([
        { reference: "LOC-01" },
        { address: "No saved reference" },
      ]),
    ),
  ).toEqual([]);
  const options = locationOptions(
    JSON.stringify([
      { reference: "LOC-01", address: "123 Test Street", tenure: "leased" },
    ]),
  );
  expect(options[0]).toEqual({
    id: "LOC-01",
    label: "123 Test Street — Leased",
  });
});
it("distinguishes duplicate address labels without exposing their internal identifiers", () => {
  const options = locationOptions(
    JSON.stringify([
      { reference: "internal-1", address: "123 Test", tenure: "leased" },
      { reference: "internal-2", address: "123 Test", tenure: "leased" },
    ]),
  );
  expect(options.map((o) => o.label)).toEqual([
    "123 Test — Leased (Location 1)",
    "123 Test — Leased (Location 2)",
  ]);
});
it("prints the saved address rather than the internal location reference", () => {
  const rows = JSON.stringify([
    { reference: "LOC-01", address: "123 Test Street", tenure: "leased" },
  ]);
  expect(displayAnswer("locations", rows)).not.toContain("LOC-01");
  const property = displayAnswer(
    "property_schedule",
    JSON.stringify([
      { location: "LOC-01", insured: "no", declinedReason: "Not requested" },
    ]),
    [],
    locationOptions(rows),
  );
  expect(property).toContain("Business location: 123 Test Street — Leased");
  expect(property).not.toContain("LOC-01");
});
