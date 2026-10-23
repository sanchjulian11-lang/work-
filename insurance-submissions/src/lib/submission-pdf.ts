import { locationOptions } from "./location-options";
import { displayAnswer, coverageLed } from "./coverage-intake";
import fontkit from "@pdf-lib/fontkit";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, rgb } from "pdf-lib";
import { activeQuestions, COVERAGES, isVerified } from "./rules";
import type { BusinessState, Snapshot } from "./types";

// Deterministic presentation only: no model rewriting or inferred client facts.
export async function submissionPDF(s: BusinessState, snapshot: Snapshot) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Commercial insurance submission - ${s.profile.legalName}`);
  pdf.registerFontkit(fontkit);
  const regular = await pdf.embedFont(
    await readFile(path.join(process.cwd(), "assets/fonts/DejaVuSans.ttf")),
    { subset: true },
  );
  const bold = await pdf.embedFont(
    await readFile(
      path.join(process.cwd(), "assets/fonts/DejaVuSans-Bold.ttf"),
    ),
    { subset: true },
  );
  let page = pdf.addPage([595.28, 841.89]);
  let y = 780;
  function text(value: string, size = 10, heavy = false) {
    const font = heavy ? bold : regular;
    const supported = new Set(font.getCharacterSet());
    for (const char of value.replace(/[\r\n]/g, "")) {
      if (!supported.has(char.codePointAt(0)!))
        throw new Error(
          "PDF font cannot represent a recorded character; use the Markdown export to preserve the original text.",
        );
    }
    for (const paragraph of value.split(/\r?\n/)) {
      let line = "";
      // Split long tokens too, so identifiers cannot overflow the page.
      for (const word of paragraph.match(/\S+/g) ?? []) {
        if (font.widthOfTextAtSize(word, size) > 491) {
          if (line) {
            draw(line);
            line = "";
          }
          for (const char of word) {
            if (font.widthOfTextAtSize(line + char, size) > 491) {
              draw(line);
              line = "";
            }
            line += char;
          }
          continue;
        }
        const next = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(next, size) > 491 && line) {
          draw(line);
          line = word;
        } else line = next;
      }
      draw(line);
    }
    function draw(line: string) {
      if (y < 62) {
        page = pdf.addPage([595.28, 841.89]);
        y = 780;
      }
      page.drawText(line, {
        x: 52,
        y,
        size,
        font,
        color: rgb(0.1, 0.19, 0.16),
      });
      y -= size * 1.45;
    }
  }
  function heading(label: string) {
    if (y < 110) {
      page = pdf.addPage([595.28, 841.89]);
      y = 780;
    }
    y -= 14;
    text(label, 14, true);
    y -= 5;
  }
  text("COMMERCIAL INSURANCE SUBMISSION", 18, true);
  text(s.profile.legalName, 15, true);
  if (s.fictional)
    text("FICTIONAL TEST ACCOUNT - NOT FOR REAL PLACEMENT", 11, true);
  text(
    `${s.profile.city}, ${s.profile.province} | ${s.profile.industry.toUpperCase()} | Revision ${s.revision}`,
  );
  text(`Operating name: ${s.profile.operatingName || "Not provided"}`);
  text(
    `Broker: ${s.approval!.brokerName} | Approved: ${s.approval!.approvedAt}`,
  );
  text(
    "All amounts are CAD. Recorded statements below were reviewed by the broker; verification is not independent proof.",
  );
  if (coverageLed(s.rulesVersion)) {
    heading("Submission scope");
    text(s.answers.market_status?.value || "Not assessed");
    text(s.answers.market_review?.value || "Not provided");
  }
  const questions = activeQuestions(s).filter((q) => isVerified(s, q.id));
  const request = questions.find((q) => q.id === "coverage_request");
  if (request) {
    heading("Coverage requested by the applicant");
    text(s.answers[request.id].value);
  }
  let section = "";
  for (const q of questions.filter((q) => q.id !== "coverage_request")) {
    if (section !== q.section) {
      section = q.section;
      heading(section);
    }
    if (y < 100) {
      page = pdf.addPage([595.28, 841.89]);
      y = 780;
    }
    text(q.label, 10, true);
    text(
      displayAnswer(
        q.id,
        s.answers[q.id].value,
        s.documents,
        locationOptions(s.answers.locations?.value),
      ),
    );
    y -= 7;
  }
  heading("Coverage considerations - inferences");
  text(
    "These are review considerations, not client statements, coverage confirmations, or commitments to bind.",
  );
  for (const code of s.draft?.plan.coverageCodes ?? []) {
    const c = COVERAGES[code as keyof typeof COVERAGES];
    text(c.label, 11, true);
    text(c.rationale);
  }
  heading("Supporting document index");
  text(
    "Listed documents are not embedded in this PDF. Attach the reviewed files separately when preparing the market package.",
  );
  for (const d of s.documents)
    text(
      `${d.name} | ${d.kind} | Broker reviewed: ${d.reviewedAt ?? "Not reviewed"}`,
    );
  if (!s.documents.length) text("No documents recorded.");
  heading("Broker approval");
  text(
    `Approved by ${s.approval!.brokerName} on ${s.approval!.approvedAt}. Revision ${s.revision}.`,
  );
  text(
    "Prepared for manual broker handling. No binding authority or insurer acceptance is implied.",
  );
  page = pdf.addPage([595.28, 841.89]);
  y = 780;
  heading("Appendix - provenance and approval record");
  text(
    `Snapshot: ${snapshot.id}\nApproval: ${snapshot.approvalId}\nGenerated: ${snapshot.generatedAt}\nRules: ${s.rulesVersion}\nApproval digest: ${snapshot.digest}`,
  );
  for (const q of questions) {
    const a = s.answers[q.id];
    y -= 8;
    if (y < 100) {
      page = pdf.addPage([595.28, 841.89]);
      y = 780;
    }
    text(q.label, 10, true);
    text(
      `Source: ${a.source}; recorded: ${a.recordedAt}; verified: ${a.verifiedAt}. Question: ${q.provenance.reference}; version: ${a.questionVersion}.`,
    );
  }
  for (const d of s.documents)
    text(`Document: ${d.name}\nSHA-256: ${d.sha256}`);
  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    p.drawText(
      `${s.fictional ? "FICTIONAL TEST | " : ""}Revision ${s.revision} | Page ${i + 1} of ${pages.length}`,
      { x: 52, y: 30, size: 8, font: regular },
    );
  });
  return pdf.save();
}
