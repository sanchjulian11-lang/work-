import { it, expect } from "vitest";
import { PDFDocument } from "pdf-lib";
import { submissionPDF } from "../src/lib/submission-pdf";
import { sampleBusiness } from "../src/lib/sample";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { approvedPilot } from "./workflow-fixture";
import { finalSubmission } from "../src/lib/domain";
import { DEMO_BROKER } from "../src/lib/sample";
it("creates a paginated PDF from recorded facts with a separate provenance appendix", async () => {
  const s = sampleBusiness();
  s.approval = {
    id: "approval-test",
    revision: s.revision,
    draftId: "draft",
    brokerId: "broker",
    brokerName: "Test broker",
    approvedAt: "2026-10-23T00:00:00Z",
    digest: "digest",
  };
  for (const a of Object.values(s.answers)) {
    a.verifiedAt = "2026-10-23T00:00:00Z";
    a.verifiedBy = "broker";
  }
  s.answers.operations.value =
    "Électricité – fictional " + "long recorded statement ".repeat(800);
  const bytes = await submissionPDF(s, {
    id: "snapshot",
    businessId: s.id,
    approvalId: "approval-test",
    revision: s.revision,
    generatedAt: "2026-10-23T00:00:00Z",
    digest: "digest",
    content: "audit",
  });
  const pdf = await PDFDocument.load(bytes);
  expect(pdf.getPageCount()).toBeGreaterThan(3);
  expect(pdf.getTitle()).toContain(s.profile.legalName);
});

it("renders the actual CGL PDF with consistent common-intake scope, neutral terms and no hidden schedules", async () => {
  const s = approvedPilot();
  // Historical hidden answers must remain in storage without entering the current export.
  s.answers.vehicle_schedule = {
    ...s.answers.operations,
    value: JSON.stringify([{ vin: "HIDDEN-AUTO-VIN-TEST" }]),
  };
  s.answers.driver_schedule = {
    ...s.answers.operations,
    value: JSON.stringify([{ licence: "HIDDEN-DRIVER-LICENCE-TEST" }]),
  };
  const { fingerprint } = await import("../src/lib/domain");
  s.approval!.digest = fingerprint(s);
  const bytes = await submissionPDF(s, finalSubmission(DEMO_BROKER, s));
  const directory = await mkdtemp(join(tmpdir(), "underwriting-pdf-test-"));
  try {
    const file = join(directory, "fictional-submission.pdf");
    await writeFile(file, bytes);
    const { stdout } = await promisify(execFile)("pdftotext", [
      "-layout",
      file,
      "-",
    ]);
    const text = stdout.replace(/\s+/g, " ");
    expect(text).toContain(
      "Broker-reviewed common intake; insurer-specific requirements not assessed",
    );
    expect(text).not.toContain("Not assessed");
    expect(text).not.toContain("HIDDEN-AUTO-VIN-TEST");
    expect(text).not.toContain("HIDDEN-DRIVER-LICENCE-TEST");
    expect(text).toContain("FICTIONAL TEST ACCOUNT");
    expect(text).toContain(
      "not client statements, coverage confirmations, or commitments to bind",
    );
    expect(text).toContain("Listed documents are not embedded in this PDF");
    expect(text).toContain(
      "No binding authority or insurer acceptance is implied",
    );
    expect(text).toContain(
      "liability, products and completed-work exposures where applicable",
    );
    expect(text).not.toContain("Contracting operations require");
    expect(text).toContain("Appendix - provenance and approval record");
    expect(text).toContain(s.approval!.digest);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
