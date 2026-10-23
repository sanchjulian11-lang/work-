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
  const pending = page.waitForEvent("download", { timeout: 15000 });
  await page
    .getByRole("button", { name: "Generate final submission (.md)" })
    .click();
  const download = await pending;
  expect(download.suggestedFilename()).toMatch(/submission-.*\.md$/);
  await page.goto("/?tab=Audit%20trail");
  await expect(
    page.getByRole("cell", { name: "final generated", exact: true }),
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
    page.getByRole("button", { name: "Generate final submission (.md)" }),
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
