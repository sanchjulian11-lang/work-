import { test, expect, type Page } from "@playwright/test";

async function createPilot(page: Page) {
  await page.goto("/review");
  await page
    .getByRole("button", { name: "Create fictional HVAC CGL pilot" })
    .click();
  await expect(page).toHaveURL(/\/intake\/[a-f0-9-]+$/);
  return new URL(page.url()).pathname;
}
async function invitation(page: Page) {
  await page.getByText("Private client invitation", { exact: true }).click();
  await page
    .getByLabel("Recipient email", { exact: true })
    .fill("client@fictional.example");
  await page
    .getByRole("button", { name: "Create private link", exact: true })
    .click();
  const input = page.getByRole("textbox", {
    name: "Private invitation link",
    exact: true,
  });
  await expect(input).toHaveValue(/\/invite#token=[a-f0-9]{64}$/);
  return input.inputValue();
}
const saved = (page: Page) =>
  expect(page.getByText("All changes saved", { exact: true })).toBeVisible();

test("private claim, durable answers and unknowns, partial handoff, queue and clarification round trip", async ({
  page,
  browser,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const path = await createPilot(page),
    link = await invitation(page);
  const clientContext = await browser.newContext({
    baseURL: "http://127.0.0.1:3100",
  });
  await clientContext.addCookies([
    { name: "demo-role", value: "client", url: "http://127.0.0.1:3100" },
  ]);
  const client = await clientContext.newPage();
  client.on("pageerror", (e) => errors.push(e.message));
  await client.goto(path);
  await expect(
    client.getByText("This page could not be found.", { exact: true }),
  ).toBeVisible();
  await client.goto(link);
  await client
    .getByRole("button", { name: "Claim application", exact: true })
    .click();
  await expect(client).toHaveURL(new RegExp(path + "$"));
  await expect(client.locator("#guided-vehicle_schedule")).toHaveCount(0);
  await expect(client.locator("#guided-driver_schedule")).toHaveCount(0);
  await expect(
    client.getByText("Private client invitation", { exact: true }),
  ).toHaveCount(0);
  await client
    .locator("#intake-operations")
    .fill("Fictional Ontario HVAC service and repair only.");
  await saved(client);
  await client
    .getByLabel("Answer status: revenue", { exact: true })
    .selectOption("unknown");
  await saved(client);
  await client.locator("#intake-years").fill("-1");
  await saved(client);
  await expect(client.locator("#guided-years")).toContainText(
    "Draft saved, but it needs correction",
  );
  await client.reload();
  await expect(client.locator("#intake-operations")).toHaveValue(
    "Fictional Ontario HVAC service and repair only.",
  );
  await expect(
    client.getByLabel("Answer status: revenue", { exact: true }),
  ).toHaveValue("unknown");
  await expect(client.locator("#intake-years")).toHaveValue("-1");
  await client.locator("#intake-years").fill("6");
  await saved(client);
  await client
    .getByRole("button", {
      name: "3. Insurance and requested terms",
      exact: true,
    })
    .click();
  await client
    .getByLabel("Answer status: current_insurance", { exact: true })
    .selectOption("unavailable");
  await saved(client);
  await client
    .getByRole("button", { name: "4. Review and send", exact: true })
    .click();
  await expect(client.getByText(/client does not know/)).toBeVisible();
  await expect(client.getByText(/not available yet/)).toBeVisible();
  await client.getByRole("checkbox").check();
  await client
    .getByRole("button", { name: "Submit to broker", exact: true })
    .click();
  await expect(
    client.getByText(
      "Your saved information was sent to your broker. You can return to add more information.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    client.getByText(/Submitted .*gaps at submission/),
  ).toBeVisible();
  await page.goto("/review");
  const card = page
    .locator("article")
    .filter({ has: page.locator(`a[href="${path}"]`) });
  await expect(card).toContainText("Submitted to broker");
  await card
    .getByRole("link", {
      name: "Fictional HVAC Service Pilot Ltd.",
      exact: true,
    })
    .click();
  const operations = page.locator("#guided-operations");
  await operations
    .getByLabel("Ask the client about this answer", { exact: true })
    .fill("Please confirm whether your service work includes installations.");
  await operations
    .getByRole("button", { name: "Request clarification", exact: true })
    .click();
  await expect(page.locator(".clarification")).toContainText(
    "Please confirm whether",
  );
  await client.reload();
  await client
    .getByLabel("Your response", { exact: true })
    .fill("No installations. Service and repair only in Ontario.");
  await clientContext.setOffline(true);
  await client
    .getByRole("button", { name: "Send response", exact: true })
    .click();
  await expect(
    client.getByText(/Your message has not been confirmed/),
  ).toBeVisible();
  await expect(client.getByLabel("Your response", { exact: true })).toHaveValue(
    "No installations. Service and repair only in Ontario.",
  );
  await clientContext.setOffline(false);
  await client
    .getByRole("button", { name: "Send response", exact: true })
    .click();
  await expect(client.locator(".clarification")).toContainText(
    "Client response: No installations.",
  );
  await page.reload();
  await page
    .getByLabel("Record your resolution", { exact: true })
    .fill("Reviewed service-only response against the recorded operations.");
  await page
    .getByRole("button", { name: "Resolve request", exact: true })
    .click();
  await expect(page.locator(".clarification")).toContainText(
    "Broker resolution: Reviewed service-only response",
  );
  await client.goto(link);
  await client
    .getByRole("button", { name: "Claim application", exact: true })
    .click();
  await expect(client.getByRole("status")).toContainText("already used");
  await client.goto(path);
  await client.setViewportSize({ width: 390, height: 844 });
  expect(
    await client.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
  await clientContext.close();
});

test("revoked links cannot claim and conflicting browser edits require explicit comparison and retry", async ({
  page,
  browser,
}) => {
  test.setTimeout(90000);
  const path = await createPilot(page),
    link = await invitation(page);
  await page
    .getByRole("button", { name: "Revoke invitation", exact: true })
    .click();
  await expect(
    page.getByText(/client@fictional.example · Revoked/),
  ).toBeVisible();
  const context = await browser.newContext({
    baseURL: "http://127.0.0.1:3100",
  });
  await context.addCookies([
    { name: "demo-role", value: "client", url: "http://127.0.0.1:3100" },
  ]);
  const client = await context.newPage();
  await client.goto(link);
  await client
    .getByRole("button", { name: "Claim application", exact: true })
    .click();
  await expect(client.getByRole("status")).toContainText("invalid");
  // Create a replacement link without changing business facts.
  await page
    .getByLabel("Recipient email", { exact: true })
    .fill("client@fictional.example");
  await page
    .getByRole("button", { name: "Create private link", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Private invitation link", exact: true }),
  ).not.toHaveValue(link);
  const replacement = await page
    .getByRole("textbox", { name: "Private invitation link", exact: true })
    .inputValue();
  expect(replacement).not.toBe(link);
  await client.goto(replacement);
  await client
    .getByRole("button", { name: "Claim application", exact: true })
    .click();
  await expect(client).toHaveURL(new RegExp(path + "$"));
  await page.reload();
  await page
    .locator("#intake-operations")
    .fill("Fictional broker confirmed service and repair.");
  await saved(page);
  await client
    .locator("#intake-operations")
    .fill("Fictional concurrent client draft for comparison.");
  await expect(
    client.getByText("Saving paused", { exact: true }),
  ).toBeVisible();
  await expect(client.locator("#intake-operations")).toHaveValue(
    "Fictional concurrent client draft for comparison.",
  );
  await expect(client.locator("#guided-operations")).toContainText(
    "Latest saved answer: Fictional broker confirmed service and repair.",
  );
  await client
    .getByRole("button", { name: "Load latest saved information", exact: true })
    .click();
  await expect(
    client.getByText(
      "Latest saved information loaded. Compare your drafts, then choose Retry my changes.",
      { exact: true },
    ),
  ).toBeVisible();
  await client
    .getByRole("button", { name: "Retry my changes", exact: true })
    .click();
  await saved(client);
  await page.reload();
  await expect(page.locator("#intake-operations")).toHaveValue(
    "Fictional concurrent client draft for comparison.",
  );
  await context.setOffline(true);
  await client.locator("#intake-payroll").fill("125000");
  await expect(
    client.getByText("Saving paused", { exact: true }),
  ).toBeVisible();
  await expect(client.locator("#intake-payroll")).toHaveValue("125000");
  await expect(
    client.getByRole("button", { name: "Retry my changes", exact: true }),
  ).toBeDisabled();
  await context.setOffline(false);
  await client
    .getByRole("button", { name: "Load latest saved information", exact: true })
    .click();
  await client
    .getByRole("button", { name: "Retry my changes", exact: true })
    .click();
  await saved(client);
  await client.reload();
  await expect(client.locator("#intake-payroll")).toHaveValue("125000");
  await context.close();
});
