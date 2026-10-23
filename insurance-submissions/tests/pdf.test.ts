import { it, expect } from "vitest";
import { PDFDocument } from "pdf-lib";
import { submissionPDF } from "../src/lib/submission-pdf";
import { sampleBusiness } from "../src/lib/sample";
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
