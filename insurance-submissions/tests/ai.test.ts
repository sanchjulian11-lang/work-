import { beforeEach, describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
const { create } = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("openai", () => ({
  default: class {
    responses = { create };
  },
}));
vi.mock("../src/lib/auth", () => ({
  isDemo: () => process.env.DEMO_MODE === "true",
}));
import { generatePlan } from "../src/lib/ai";
import { sampleBusiness, DEMO_BROKER } from "../src/lib/sample";
import { verifyAnswer } from "../src/lib/domain";
import { activeQuestions } from "../src/lib/rules";
beforeEach(() => {
  vi.unstubAllEnvs();
  create.mockReset();
});
describe("AI boundary", () => {
  it("supports a truthful rules-only fallback without an external request", async () => {
    const result = await generatePlan(sampleBusiness(), false);
    expect(result.mode).toBe("rules");
    expect(create).not.toHaveBeenCalled();
  });
  it("refuses external requests in demo mode", async () => {
    vi.stubEnv("DEMO_MODE", "true");
    await expect(generatePlan(sampleBusiness(), true)).rejects.toThrow("demo");
    expect(create).not.toHaveBeenCalled();
  });
  it("requires an explicit processing flag and key", async () => {
    vi.stubEnv("DEMO_MODE", "false");
    vi.stubEnv("AI_PROCESSING_ENABLED", "false");
    await expect(generatePlan(sampleBusiness(), true)).rejects.toThrow(
      "authorized",
    );
    expect(create).not.toHaveBeenCalled();
  });
  it("sends no client answer text or documents and disables API storage", async () => {
    vi.stubEnv("DEMO_MODE", "false");
    vi.stubEnv("AI_PROCESSING_ENABLED", "true");
    vi.stubEnv("OPENAI_API_KEY", "fictional-test-key");
    const s = verifyAnswer(DEMO_BROKER, sampleBusiness(), "revenue");
    create.mockResolvedValue({
      output_text: JSON.stringify({
        overviewQuestionIds: ["revenue"],
        coverageCodes: ["cgl"],
        followUpQuestionIds: activeQuestions(s)
          .filter((q) => !s.answers[q.id]?.verifiedBy)
          .map((q) => q.id),
      }),
    });
    expect((await generatePlan(s, true)).mode).toBe("ai");
    const input = create.mock.calls[0][0];
    expect(input.store).toBe(false);
    expect(input.input).not.toContain("750000");
    expect(input.input).not.toContain("Maple Air");
    expect(input.input).not.toContain("London");
  });
  it("rejects free-form model claims and invented references without saving a draft", async () => {
    vi.stubEnv("DEMO_MODE", "false");
    vi.stubEnv("AI_PROCESSING_ENABLED", "true");
    vi.stubEnv("OPENAI_API_KEY", "fictional-test-key");
    create.mockResolvedValue({
      output_text: JSON.stringify({
        overviewQuestionIds: [],
        coverageCodes: ["invented"],
        followUpQuestionIds: [],
      }),
    });
    await expect(generatePlan(sampleBusiness(), true)).rejects.toThrow(
      "unsupported",
    );
    create.mockResolvedValue({
      output_text: JSON.stringify({
        overviewQuestionIds: [],
        coverageCodes: [],
        followUpQuestionIds: [],
        revenue: "invented",
      }),
    });
    await expect(generatePlan(sampleBusiness(), true)).rejects.toThrow();
  });
  it("does not silently replace a failed API call with a claimed AI summary", async () => {
    vi.stubEnv("DEMO_MODE", "false");
    vi.stubEnv("AI_PROCESSING_ENABLED", "true");
    vi.stubEnv("OPENAI_API_KEY", "fictional-test-key");
    create.mockRejectedValue(new Error("API unavailable"));
    await expect(generatePlan(sampleBusiness(), true)).rejects.toThrow(
      "API unavailable",
    );
  });
});
