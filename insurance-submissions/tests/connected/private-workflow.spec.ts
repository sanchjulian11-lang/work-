import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { readFile, mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createClient } from "@supabase/supabase-js";
import { PDFDocument, StandardFonts } from "pdf-lib";
const fixture = JSON.parse(
  readFileSync(process.env.CONNECTED_FIXTURE_FILE!, "utf8"),
) as {
  id: string;
  brokerEmail: string;
  clientEmail: string;
  otherEmail: string;
  password: string;
  values: Record<string, string>;
};
const api = process.env.NEXT_PUBLIC_SUPABASE_URL!;
async function signIn(page: Page, email: string) {
  await page.goto("/");
  await page.getByLabel("Work email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(fixture.password);
  await page
    .getByRole("button", { name: "Sign in securely", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Sign out", exact: true }),
  ).toBeVisible();
}
async function saved(page: Page) {
  await expect(
    page.getByText("All changes saved", { exact: true }),
  ).toBeVisible();
}

test("real Auth, captured confirmation mail, private Storage and complete fictional client-to-broker approval", async ({
  page,
  browser,
  request,
}) => {
  const dir = await mkdtemp(
    join(tmpdir(), "underwriting-connected-artifacts-"),
  );
  const clientContext = await browser.newContext({
      baseURL: "http://127.0.0.1:3102",
    }),
    otherContext = await browser.newContext({
      baseURL: "http://127.0.0.1:3102",
    });
  const client = await clientContext.newPage(),
    other = await otherContext.newPage();
  const path = "/intake/" + fixture.id;
  try {
    await signIn(page, fixture.brokerEmail);
    await signIn(other, fixture.otherEmail);
    await other.goto(path);
    await expect(
      other.getByText("This page could not be found.", { exact: true }),
    ).toBeVisible();
    await page.goto(path);
    await page.getByText("Private client invitation", { exact: true }).click();
    await page
      .getByLabel("Recipient email", { exact: true })
      .fill(fixture.clientEmail);
    await page
      .getByRole("button", { name: "Create private link", exact: true })
      .click();
    const inviteInput = page.getByRole("textbox", {
      name: "Private invitation link",
      exact: true,
    });
    await expect(inviteInput).toHaveValue(/#token=[a-f0-9]{64}$/);
    const link = await inviteInput.inputValue();
    await client.goto(link);
    await client.getByLabel("Email", { exact: true }).fill(fixture.clientEmail);
    await client.getByLabel("Password", { exact: true }).fill(fixture.password);
    await client
      .getByLabel("Account action", { exact: true })
      .selectOption("signup");
    await client
      .getByRole("button", { name: "Continue securely", exact: true })
      .click();
    await expect(client.getByRole("status")).toContainText("Check your email");
    let mailId = "";
    await expect
      .poll(
        async () => {
          const result = await request.get(
            "http://127.0.0.1:55424/api/v1/messages",
          );
          if (!result.ok()) return false;
          const data = await result.json();
          const mail = data.messages?.find(
            (m: { ID: string; To: { Address: string }[] }) =>
              m.To?.some(
                (t) => t.Address.toLowerCase() === fixture.clientEmail,
              ),
          );
          mailId = mail?.ID ?? "";
          return !!mailId;
        },
        { timeout: 15000 },
      )
      .toBe(true);
    const mail = await (
      await request.get("http://127.0.0.1:55424/api/v1/message/" + mailId)
    ).json();
    const content = String(mail.HTML ?? mail.Text ?? "").replace(/&amp;/g, "&");
    const match = content.match(
      /https?:\/\/[^\s"<>]+\/auth\/v1\/verify\?[^\s"<>]+/,
    );
    if (!match) throw new Error("Captured confirmation link was not found");
    const confirmation = new URL(match[0]);
    if (
      !["127.0.0.1", "localhost"].includes(confirmation.hostname) ||
      confirmation.port !== "55421"
    )
      throw new Error("Confirmation link must stay in the local test stack");
    const confirmed = await request.get(confirmation.href);
    expect(confirmed.ok()).toBe(true);
    await client.goto(link);
    await client.getByLabel("Email", { exact: true }).fill(fixture.clientEmail);
    await client.getByLabel("Password", { exact: true }).fill(fixture.password);
    await client
      .getByLabel("Account action", { exact: true })
      .selectOption("login");
    await client
      .getByRole("button", { name: "Continue securely", exact: true })
      .click();
    await expect(
      client.getByRole("button", { name: "Claim application", exact: true }),
    ).toBeEnabled();
    await client
      .getByRole("button", { name: "Claim application", exact: true })
      .click();
    await expect(client).toHaveURL(new RegExp(path + "$"));
    await expect(client.locator("#guided-vehicle_schedule")).toHaveCount(0);
    await expect(client.locator("#guided-driver_schedule")).toHaveCount(0);
    await client.locator("#intake-operations").fill(fixture.values.operations);
    await saved(client);
    await client
      .getByLabel("Answer status: revenue", { exact: true })
      .selectOption("unknown");
    await saved(client);
    await client.reload();
    await expect(client.locator("#intake-operations")).toHaveValue(
      fixture.values.operations,
    );
    await expect(
      client.getByLabel("Answer status: revenue", { exact: true }),
    ).toHaveValue("unknown");
    await client
      .getByRole("button", { name: "4. Review and send", exact: true })
      .click();
    await client.getByRole("checkbox").check();
    await client
      .getByRole("button", { name: "Submit to broker", exact: true })
      .click();
    await expect(
      client.getByText(/Your saved information was sent to your broker/),
    ).toBeVisible();
    await page.goto("/review");
    const row = page
      .locator("article")
      .filter({ has: page.locator(`a[href="${path}"]`) });
    await expect(row).toContainText("Submitted to broker");
    await page.goto(path);
    await page
      .locator("#guided-operations")
      .getByLabel("Ask the client about this answer", { exact: true })
      .fill("Please confirm that this request excludes installation work.");
    await page
      .locator("#guided-operations")
      .getByRole("button", { name: "Request clarification", exact: true })
      .click();
    await expect(page.locator(".clarification")).toContainText(
      "excludes installation",
    );
    await client.reload();
    await client
      .getByLabel("Your response", { exact: true })
      .fill("FICTIONAL TEST: Service and repair only. No installation work.");
    await client
      .getByRole("button", { name: "Send response", exact: true })
      .click();
    await expect(client.locator(".clarification")).toContainText(
      "Client response: FICTIONAL TEST",
    );
    await page.reload();
    await page
      .getByLabel("Record your resolution", { exact: true })
      .fill("Confirmed the fictional service-only scope with the client.");
    await page
      .getByRole("button", { name: "Resolve request", exact: true })
      .click();
    await expect(page.locator(".clarification")).toContainText(
      "Broker resolution:",
    );

    // Complete the client's own questions through the actual application actions.
    await client.goto(path);
    for (let step = 0; step < 3; step++) {
      await client
        .getByRole("navigation", { name: "Intake steps" })
        .getByRole("button")
        .nth(step)
        .click();
      const ids = await client
        .locator('article[id^="guided-"]')
        .evaluateAll((nodes) => nodes.map((n) => n.id.replace("guided-", "")));
      for (const id of ids) {
        const value = fixture.values[id];
        if (value === undefined)
          throw new Error("Missing fictional answer fixture for " + id);
        const article = client.locator("#guided-" + id);
        await article
          .getByLabel("Answer status: " + id, { exact: true })
          .selectOption("answered");
        if (id === "locations") {
          await article
            .getByRole("button", { name: "Add record", exact: true })
            .click();
          const data = JSON.parse(value)[0];
          const record = article.locator("fieldset");
          await record
            .getByLabel("Full civic address and postal code, record 1", {
              exact: true,
            })
            .fill(data.address);
          await record
            .getByLabel("Tenure, record 1", { exact: true })
            .selectOption(data.tenure);
          await record
            .getByLabel(
              "Your occupancy, other occupants, and neighbouring exposures, record 1",
              { exact: true },
            )
            .fill(data.occupancy);
          await record
            .getByLabel(
              "Lease / ownership responsibilities and insurance obligations, record 1",
              { exact: true },
            )
            .fill(data.leaseResponsibilities);
        } else {
          const field = client.locator("#intake-" + id);
          if ((await field.evaluate((n) => n.tagName)) === "SELECT")
            await field.selectOption(value);
          else await field.fill(value);
        }
        await saved(client);
      }
    }

    // Upload/download a real private object; no demo storage adapter is involved.
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    pdf
      .addPage()
      .drawText("FICTIONAL HVAC SUPPORTING DOCUMENT - CONNECTED TEST ONLY", {
        font,
        size: 12,
      });
    const bytes = await pdf.save(),
      file = join(dir, "fictional-hvac-support.pdf");
    await writeFile(file, bytes);
    await client.goto("/?business=" + fixture.id + "&tab=Documents");
    await client
      .getByLabel("Document category", { exact: true })
      .selectOption("other");
    await client
      .getByLabel("Select document", { exact: true })
      .setInputFiles(file);
    await client
      .getByRole("button", { name: "Upload securely", exact: true })
      .click();
    await expect(client.getByRole("status")).toContainText("Saved");
    await client.goto("/?business=" + fixture.id + "&tab=Documents");
    const downloadPromise = client.waitForEvent("download");
    await client
      .getByRole("link", { name: "Download attachment", exact: true })
      .click();
    const download = await downloadPromise;
    expect(
      createHash("sha256")
        .update(await readFile((await download.path())!))
        .digest("hex"),
    ).toBe(createHash("sha256").update(bytes).digest("hex"));
    const objectHref = await client
      .getByRole("link", { name: "Download attachment", exact: true })
      .getAttribute("href");
    expect((await other.request.get(objectHref!)).status()).toBe(403);
    expect((await request.get(objectHref!)).status()).toBe(401);

    await page.goto("/?business=" + fixture.id + "&tab=Documents");
    await page
      .getByRole("checkbox", {
        name: "I reviewed this attachment and its relevance.",
        exact: true,
      })
      .check();
    await page
      .getByRole("button", { name: "Record document review", exact: true })
      .click();
    await page.goto("/?business=" + fixture.id + "&tab=Questionnaire");
    await page
      .locator("#answer-coverage_scope")
      .fill(fixture.values.coverage_scope);
    await page
      .locator("#question-coverage_scope")
      .getByRole("button", { name: "Save answer", exact: true })
      .click();
    await page.goto("/?business=" + fixture.id + "&tab=Questionnaire");
    await page
      .locator("#question-intake_attestation select")
      .selectOption("yes");
    await expect(
      page.locator("#question-intake_attestation").getByRole("status"),
    ).toHaveText("Saved");
    const questions = await page
      .locator("article.question")
      .evaluateAll((nodes) => nodes.map((n) => n.id));
    for (const id of questions) {
      await page.goto("/?business=" + fixture.id + "&tab=Questionnaire");
      await page
        .locator("#" + id)
        .getByRole("button", { name: "Verify recorded statement", exact: true })
        .click();
      await expect(
        page.locator("#" + id).getByText("Broker verified", { exact: true }),
      ).toBeVisible();
    }
    await page.goto("/?business=" + fixture.id + "&tab=Broker%20review");
    await page
      .getByRole("button", { name: "Prepare rules-based draft", exact: true })
      .click();
    await page.goto("/?business=" + fixture.id + "&tab=Broker%20review");
    await page.getByRole("checkbox").check();
    await page
      .getByRole("button", { name: "Approve this revision", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText(
      "Broker approval recorded",
    );
    await page.goto("/?business=" + fixture.id + "&tab=Broker%20review");
    const finalDownload = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Download submission PDF", exact: true })
      .click();
    const final = await finalDownload;
    const { stdout } = await promisify(execFile)("pdftotext", [
      (await final.path())!,
      "-",
    ]);
    expect(stdout.replace(/\s+/g, " ")).toContain(
      "Broker-reviewed common intake; insurer-specific requirements not assessed",
    );
    expect(stdout).not.toContain("Vehicle identification");

    const clientSDK = createClient(
      api,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } },
    );
    const session = await clientSDK.auth.signInWithPassword({
      email: fixture.clientEmail,
      password: fixture.password,
    });
    expect(session.error).toBeNull();
    expect(
      (await clientSDK.from("intake_invitations").select("*")).error,
    ).not.toBeNull();
    expect(
      (
        await clientSDK.rpc("claim_intake_invitation", {
          p_actor: session.data.user!.id,
          p_token_hash: "a".repeat(64),
        })
      ).error,
    ).not.toBeNull();
    const visible = await clientSDK
      .from("client_businesses")
      .select("state")
      .eq("id", fixture.id)
      .single();
    expect(visible.error).toBeNull();
    expect(visible.data!.state).not.toHaveProperty("approval");
    expect(visible.data!.state).not.toHaveProperty("draft");
    await client.goto(path);
    await client.locator("#intake-payroll").fill("95000");
    await saved(client);
    await page.goto("/?business=" + fixture.id + "&tab=Broker%20review");
    await expect(
      page.getByRole("button", {
        name: "Download submission PDF",
        exact: true,
      }),
    ).toHaveCount(0);
    expect(
      (
        await page.request.post("/api/submission/" + fixture.id, {
          headers: { origin: "http://127.0.0.1:3102" },
        })
      ).status(),
    ).toBe(403);
    await client.goto("/");
    await client.getByRole("button", { name: "Sign out", exact: true }).click();
    expect((await client.request.get(objectHref!)).status()).toBe(401);
  } finally {
    await clientContext.close();
    await otherContext.close();
    await rm(dir, { recursive: true, force: true });
  }
});
