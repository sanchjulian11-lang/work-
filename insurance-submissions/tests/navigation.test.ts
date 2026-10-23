import { describe, it, expect } from "vitest";
import { actionDestination } from "../src/lib/navigation";
describe("safe action navigation", () => {
  it("keeps submitted data from changing the redirect host or tab", () => {
    const path = actionDestination(
      "answer",
      "//example.com/?tab=Audit trail",
      "error",
      "Bad & value",
      "payroll",
    );
    const url = new URL(path, "https://app.example");
    expect(url.origin).toBe("https://app.example");
    expect(url.searchParams.get("business")).toBe(
      "//example.com/?tab=Audit trail",
    );
    expect(url.searchParams.get("tab")).toBe("Questionnaire");
    expect(url.searchParams.get("error")).toBe("Bad & value");
    expect(url.hash).toBe("#question-payroll");
  });
  it("ignores unsupported actions and unsafe question anchors", () => {
    const url = new URL(
      actionDestination(
        "https://example.com",
        "id",
        "message",
        "Saved",
        "#unsafe?tab=Broker review",
      ),
      "https://app.example",
    );
    expect(url.searchParams.get("tab")).toBe("Overview");
    expect(url.hash).toBe("");
    const invalid = new URL(
      actionDestination("verify", "id", "message", "Saved", "../operations"),
      "https://app.example",
    );
    expect(invalid.hash).toBe("");
    expect(invalid.searchParams.has("question")).toBe(false);
  });
});
