import { test, expect } from "@playwright/test";
test("fictional intake, conditional questions, role boundaries, and export gate", async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Maple Air HVAC Ltd. (Fictional)" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Questionnaire", exact: true }).click();
  await expect(
    page.getByLabel("Describe hot-work frequency", { exact: false }),
  ).toBeVisible();
  const hotWork = page
    .locator("article")
    .filter({ has: page.locator("#answer-hot_work") });
  await hotWork.locator("select").selectOption("no");
  await hotWork.getByRole("button", { name: "Save answer" }).click();
  await page.getByRole("link", { name: "Questionnaire", exact: true }).click();
  await expect(page.locator("#answer-hot_work_controls")).toHaveCount(0);
  await page
    .locator("article")
    .filter({ has: page.locator("#answer-revenue") })
    .getByRole("button", { name: "Verify recorded statement" })
    .click();
  await page.getByRole("link", { name: "Questionnaire", exact: true }).click();
  await expect(
    page
      .locator("article")
      .filter({ has: page.locator("#answer-revenue") })
      .getByText("Broker verified", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Broker review", exact: true }).click();
  await page.getByRole("button", { name: "Prepare rules-based draft" }).click();
  await expect(page.getByRole("status")).toContainText("Draft prepared");
  await page.getByRole("link", { name: "Broker review", exact: true }).click();
  await expect(page.locator(".summary-preview")).toContainText("750000");
  await expect(page.locator(".summary-preview")).toContainText("Not provided");
  await expect(
    page.getByRole("button", { name: "Approve this revision" }),
  ).toBeDisabled();
  const response = await request.post(
    "/api/submission/00000000-0000-4000-8000-000000000010",
    { headers: { origin: "http://127.0.0.1:3100" } },
  );
  expect(response.status()).toBe(403);
  await page.getByRole("button", { name: "Preview as client" }).click();
  await expect(
    page.getByRole("link", { name: "Broker review", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "Questionnaire", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Verify recorded statement" }),
  ).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("body")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test("complete broker review, approve, export, and revoke approval after a change", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.goto("/?tab=Questionnaire");
  const ids = await page
    .locator("article.question [name=value]")
    .evaluateAll((nodes) => nodes.map((n) => n.id));
  for (const id of ids) {
    await page.goto("/?tab=Questionnaire");
    const input = page.locator("#" + id);
    const tag = await input.evaluate((n) => n.tagName);
    const type = await input.getAttribute("type");
    if (tag === "TEXTAREA")
      await input.fill(
        id === "answer-revenue_split"
          ? "60% residential, 40% commercial"
          : "Fictional confirmed demonstration response.",
      );
    else if (type === "number") await input.fill("100");
    const article = page
      .locator("article")
      .filter({ has: page.locator("#" + id) });
    await article.getByRole("button", { name: "Save answer" }).click();
    await expect(page.getByRole("status")).toContainText("Saved");
  }
  await page.goto("/?tab=Questionnaire");
  // Saving conditional parent answers revokes dependent verification, so verify after all edits.
  for (const id of await page
    .locator("article.question [name=value]")
    .evaluateAll((nodes) => nodes.map((n) => n.id))) {
    await page.goto("/?tab=Questionnaire");
    await page
      .locator("article")
      .filter({ has: page.locator("#" + id) })
      .getByRole("button", { name: "Verify recorded statement" })
      .click();
    await expect(page.getByRole("status")).toContainText("Saved");
  }
  await page.goto("/?tab=Broker%20review");
  await page.getByRole("button", { name: "Prepare rules-based draft" }).click();
  await expect(page.getByRole("status")).toContainText("Draft prepared");
  await page.goto("/?tab=Broker%20review");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Approve this revision" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Broker approval recorded",
  );
  await page.goto("/?tab=Broker%20review");
  const pdfPending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download submission PDF" }).click();
  const pdfDownload = await pdfPending;
  expect(pdfDownload.suggestedFilename()).toMatch(/submission-.*\.pdf$/);
  await page.goto("/?tab=Audit%20trail");
  await expect(
    page.getByRole("cell", { name: "final generated", exact: true }).first(),
  ).toBeVisible();
  await page.goto("/?tab=Questionnaire");
  await page.locator("#answer-payroll").fill("250000");
  await page
    .locator("article")
    .filter({ has: page.locator("#answer-payroll") })
    .getByRole("button", { name: "Save answer" })
    .click();
  await page.goto("/?tab=Broker%20review");
  await expect(
    page.getByRole("button", { name: "Download submission PDF" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Approve this revision" }),
  ).toBeDisabled();
});

test("save, verify, and validation errors stay at the same question", async ({
  page,
}) => {
  await page.goto("/?tab=Questionnaire");
  const question = page.locator("#question-payroll");
  await question.locator("[name=value]").fill("275000");
  await question.getByRole("button", { name: "Save answer" }).click();
  await expect(page).toHaveURL(
    /tab=Questionnaire.*question=payroll#question-payroll$/,
  );
  await expect(question.getByRole("status")).toHaveText("Saved");
  await expect(question.getByRole("status")).toBeInViewport();
  await expect(question.getByText("Unverified", { exact: true })).toBeVisible();
  await question
    .getByRole("button", { name: "Verify recorded statement" })
    .click();
  await expect(
    question.getByText("Broker verified", { exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(
    /tab=Questionnaire.*question=payroll#question-payroll$/,
  );
  // Force an invalid request past browser validation to exercise the server error redirect.
  await question
    .locator("form")
    .first()
    .evaluate((form: HTMLFormElement) => {
      form.noValidate = true;
    });
  await question.locator("[name=value]").fill("-1");
  await question.getByRole("button", { name: "Save answer" }).click();
  await expect(question.getByRole("alert")).toContainText(
    "Number is outside the permitted range",
  );
  await expect(question.getByRole("alert")).toBeInViewport();
  await expect(page).toHaveURL(
    /tab=Questionnaire.*question=payroll#question-payroll$/,
  );
  await page.reload();
  await expect(question.locator("[name=value]")).toHaveValue("275000");
  await expect(
    question.getByText("Broker verified", { exact: true }),
  ).toBeVisible();
});

test("new coverage-led application branches and saves structured locations", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await page
    .getByText("Create another business profile", { exact: true })
    .click();
  const create = page.locator("form").filter({
    has: page.getByRole("button", {
      name: "Create application",
      exact: true,
    }),
  });
  await create
    .getByLabel("Legal name", { exact: true })
    .fill("Coverage Branching HVAC (Fictional)");
  await create
    .getByLabel("Operating name", { exact: true })
    .fill("Coverage Branching Test");
  await create.getByLabel("City", { exact: true }).fill("London");
  await create
    .getByRole("button", { name: "Create application", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Saved");
  const business = new URL(page.url()).searchParams.get("business")!;
  await page.getByRole("link", { name: "Questionnaire", exact: true }).click();
  await expect(
    page.getByText("Coverage-led common intake:", { exact: false }),
  ).toBeVisible();
  await expect(page.locator("#answer-vehicle_schedule")).toHaveCount(0);
  async function choose(id: string, option: string) {
    const article = page.locator(`#question-${id}`);
    await article.locator("select").selectOption(option);
    await expect(article.getByRole("status")).toHaveText("Saved");
  }
  await choose("cover_cgl", "yes");
  await expect(page.locator("#answer-vehicles")).toHaveCount(0);
  await choose("cover_auto", "yes");
  await expect(page.locator("#answer-vehicle_schedule")).toBeVisible();
  await expect(page.locator("#answer-driver_schedule")).toBeVisible();
  await choose("vehicles", "yes");
  await choose("cover_auto", "no");
  await expect(page.locator("#answer-vehicle_schedule")).toHaveCount(0);
  const loc = page.locator("#question-locations");
  await loc.getByRole("button", { name: "Add record", exact: true }).click();
  await expect(
    loc.getByLabel("Location reference", { exact: false }),
  ).toHaveCount(0);
  await loc
    .getByLabel("Full civic address and postal code, record 1", { exact: true })
    .fill("123 Fictional Street, London ON N6A 1A1");
  await loc
    .getByLabel("Tenure, record 1", { exact: true })
    .selectOption("leased");
  await loc
    .getByLabel(
      "Your occupancy, other occupants, and neighbouring exposures, record 1",
      { exact: true },
    )
    .fill("Fictional HVAC workshop");
  await loc
    .getByLabel(
      "Lease / ownership responsibilities and insurance obligations, record 1",
      { exact: true },
    )
    .fill(
      "Tenant insures contents and improvements; landlord insures building.",
    );
  await loc.getByRole("button", { name: "Save answer", exact: true }).click();
  await expect(loc.getByRole("status")).toHaveText("Saved");
  await page.reload();
  await expect(loc.getByLabel("Tenure, record 1", { exact: true })).toHaveValue(
    "leased",
  );
  await choose("cover_property", "yes");
  await expect(page.locator("#answer-property_schedule")).toBeVisible();
  const property = page.locator("#question-property_schedule");
  await property
    .getByRole("button", { name: "Add record", exact: true })
    .click();
  await property
    .getByLabel("Business location, record 1", { exact: true })
    .selectOption({
      label: "123 Fictional Street, London ON N6A 1A1 — Leased",
    });
  await property
    .getByLabel("Property coverage requested at this location?, record 1", {
      exact: true,
    })
    .selectOption("no");
  await expect(
    property.getByLabel("Wall, roof, and floor construction, record 1", {
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(
    property.getByLabel(
      "Reason property coverage is not requested here, record 1",
      { exact: true },
    ),
  ).toBeVisible();
  await property
    .getByLabel("Reason property coverage is not requested here, record 1", {
      exact: true,
    })
    .fill("Fictional client declined this location.");
  await property
    .getByRole("button", { name: "Save answer", exact: true })
    .click();
  await expect(property.getByRole("status")).toHaveText("Saved");
  await page.reload();
  await expect(
    property
      .getByLabel("Business location, record 1", { exact: true })
      .locator("option:checked"),
  ).toHaveText("123 Fictional Street, London ON N6A 1A1 — Leased");
  // Tenant contents coverage: partial saves persist, but cannot be verified.
  const requested = property.getByLabel(
    "Property coverage requested at this location?, record 1",
    { exact: true },
  );
  const building = property.getByLabel(
    "Building coverage requested?, record 1",
    { exact: true },
  );
  await requested.selectOption("yes");
  await building.selectOption("no");
  await property
    .getByLabel("Building valuation status, record 1", { exact: true })
    .selectOption("not applicable");
  await expect(
    property.getByLabel("Building replacement value (CAD), record 1", {
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(
    property.getByLabel("Wall, roof, and floor construction, record 1", {
      exact: true,
    }),
  ).toBeVisible();
  await property
    .getByRole("button", { name: "Save answer", exact: true })
    .click();
  await expect(property.getByRole("status")).toHaveText("Saved");
  await page.reload();
  await expect(requested).toHaveValue("yes");
  await expect(building).toHaveValue("no");
  await expect(
    property.getByLabel("Building valuation status, record 1", { exact: true }),
  ).toHaveValue("not applicable");
  await expect(
    property
      .getByLabel("Business location, record 1", { exact: true })
      .locator("option:checked"),
  ).toHaveText("123 Fictional Street, London ON N6A 1A1 — Leased");
  await property
    .getByRole("button", { name: "Verify recorded statement", exact: true })
    .click();
  await expect(property.getByRole("alert")).toContainText(
    "construction is required",
  );
  await expect(
    property.getByText("Broker verified", { exact: true }),
  ).toHaveCount(0);
  await page.reload();
  await expect(
    property.getByText("Broker verified", { exact: true }),
  ).toHaveCount(0);
  // Removing a location must not silently relink property to another address.
  await loc
    .getByRole("button", { name: "Remove record 1", exact: true })
    .click();
  await loc.getByRole("button", { name: "Save answer", exact: true }).click();
  await expect(loc.getByRole("status")).toHaveText("Saved");
  await page.reload();
  await expect(
    property
      .getByLabel("Business location, record 1", { exact: true })
      .locator("option:checked"),
  ).toHaveText(
    "Previously linked location unavailable — choose a saved address",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.getByRole("link", { name: "Broker review", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Approve this revision" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Preview as client" }).click();
  await expect(
    page.getByRole("link", { name: "Broker review", exact: true }),
  ).toHaveCount(0);
  await page.goto(`/?business=${business}&tab=Questionnaire`);
  // New unassigned business is never exposed to a client merely by supplying its ID.
  await expect(
    page.getByRole("heading", { name: "Coverage Branching HVAC (Fictional)" }),
  ).toHaveCount(0);
  const denied = await page.request.post(
    `/api/submission/${business}?format=pdf`,
    {
      headers: { origin: "http://127.0.0.1:3100" },
    },
  );
  expect(denied.status()).toBe(403);
});

test("updated intake autosaves in order, retains drafts, and recovers from network and stale-session errors", async ({
  page,
  context,
}) => {
  test.setTimeout(120000);
  await page.goto(
    "/?business=00000000-0000-4000-8000-000000000010&tab=Questionnaire",
  );
  await page
    .getByRole("button", {
      name: "Start updated intake from saved answers",
      exact: true,
    })
    .click();
  await expect(
    page.getByText("Updated intake copied from saved answers.", {
      exact: false,
    }),
  ).toBeVisible();
  const business = new URL(page.url()).searchParams.get("business")!;
  expect(business).not.toBe("00000000-0000-4000-8000-000000000010");
  const q = (id: string) => page.locator(`#question-${id}`);
  async function choose(id: string, option: string) {
    await q(id).locator("select").selectOption(option);
    await expect(q(id).getByRole("status")).toHaveText("Saved");
  }
  await choose("cover_cgl", "yes");
  await choose("cover_auto", "no");
  await expect(page.locator("#answer-vehicles")).toHaveCount(0);
  await expect(
    q("cover_cgl").getByText("Unverified", { exact: true }),
  ).toBeVisible();
  const draft =
    "Fictional unsaved operations draft preserved while changing coverage.";
  await page.locator("#answer-operations").fill(draft);
  await q("cover_auto").locator("select").selectOption("yes");
  await q("cover_property").locator("select").selectOption("yes");
  await expect(q("cover_property").getByRole("status")).toHaveText("Saved");
  await expect(page.locator("#answer-vehicles")).toBeVisible();
  await expect(page.locator("#answer-property_schedule")).toBeVisible();
  await expect(page.locator("#answer-operations")).toHaveValue(draft);
  await expect(
    q("operations").getByText("Unsaved changes", { exact: true }),
  ).toBeVisible();
  await q("operations")
    .getByRole("button", { name: "Save answer", exact: true })
    .click();
  await expect(q("operations").getByRole("status")).toHaveText("Saved");
  await choose("cover_auto", "no");
  await expect(page.locator("#answer-vehicles")).toHaveCount(0);
  await expect(page.locator("#answer-driver_schedule")).toHaveCount(0);
  await choose("hot_work", "yes");
  await page
    .locator("#answer-hot_work_controls")
    .fill("Fictional unsaved fire-watch details.");
  await choose("hot_work", "no");
  await expect(page.locator("#answer-hot_work_controls")).toHaveCount(0);
  await choose("hot_work", "yes");
  await expect(page.locator("#answer-hot_work_controls")).toHaveValue(
    "Fictional unsaved fire-watch details.",
  );
  // Drop an action before it reaches the server; do not show a false Saved status.
  let failOnce = true;
  await page.route("**/*", async (route) => {
    if (
      failOnce &&
      route.request().method() === "POST" &&
      route.request().headers()["next-action"]
    ) {
      failOnce = false;
      await route.abort("failed");
    } else await route.continue();
  });
  await q("design").locator("select").selectOption("yes");
  await expect(q("design").getByRole("alert")).toContainText(
    "Save could not be confirmed",
  );
  await expect(q("design").locator("select")).toHaveValue("yes");
  await page
    .getByRole("button", { name: "Review latest version", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Review latest version", exact: true }),
  ).toHaveCount(0);
  await q("design")
    .getByRole("button", { name: "Retry save", exact: true })
    .click();
  await expect(q("design").getByRole("status")).toHaveText("Saved");
  await expect(
    q("design").getByText("Unverified", { exact: true }),
  ).toBeVisible();
  await q("design")
    .getByRole("button", { name: "Verify recorded statement", exact: true })
    .click();
  await expect(
    q("design").getByText("Broker verified", { exact: true }),
  ).toBeVisible();
  // Another tab saves first. The stale tab must pause rather than overwrite it.
  const other = await context.newPage();
  await other.goto(`/?business=${business}&tab=Questionnaire`);
  await other.locator("#answer-cover_equipment").selectOption("yes");
  await expect(
    other.locator("#question-cover_equipment").getByRole("status"),
  ).toHaveText("Saved");
  await q("cover_cgl").locator("select").selectOption("no");
  await expect(q("cover_cgl").getByRole("alert")).toContainText(
    "another session",
  );
  await page
    .getByRole("button", { name: "Review latest version", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Review latest version", exact: true }),
  ).toHaveCount(0);
  await q("cover_cgl")
    .getByRole("button", { name: "Retry save", exact: true })
    .click();
  await expect(q("cover_cgl").getByRole("status")).toHaveText("Saved");
  await expect(page.locator("#answer-cgl_limits")).toHaveCount(0);
  await page.reload();
  await expect(page.locator("#answer-cover_equipment")).toHaveValue("yes");
  await expect(page.locator("#answer-cover_cgl")).toHaveValue("no");
  await expect(page.locator("#answer-operations")).toHaveValue(draft);
  await other.close();
});

test("retail intake opens product follow-ups without contractor questions and persists its class", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByText("Create another business profile", { exact: true })
    .click();
  const create = page.locator("form").filter({
    has: page.getByRole("button", {
      name: "Create application",
      exact: true,
    }),
  });
  await create
    .getByLabel("Legal name", { exact: true })
    .fill("Fictional Retail Test Ltd.");
  await create.getByLabel("Operating name", { exact: true }).fill("Test Store");
  await create.getByLabel("City", { exact: true }).fill("London");
  await create.locator("select[name=industry]").selectOption("retail");
  await create
    .getByRole("button", { name: "Create application", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Saved");
  await page.getByRole("link", { name: "Questionnaire", exact: true }).click();
  await expect(page.locator("#question-retail_product_mix")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Broker intake review" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Market review" }),
  ).toHaveCount(0);
  await expect(page.locator("#question-intake_attestation")).toBeVisible();
  await expect(page.locator("#question-hot_work")).toHaveCount(0);
  await expect(page.locator("#question-retail_import_details")).toHaveCount(0);
  await page.locator("#question-retail_imports select").selectOption("yes");
  await expect(
    page.locator("#question-retail_imports").getByRole("status"),
  ).toHaveText("Saved");
  await expect(page.locator("#question-retail_import_details")).toBeVisible();
  await page.reload();
  await expect(page.locator("#question-retail_import_details")).toBeVisible();
  await expect(page.locator("#question-hot_work")).toHaveCount(0);
});
