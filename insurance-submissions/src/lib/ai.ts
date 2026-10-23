import "server-only";
import OpenAI from "openai";
import { activeQuestions, isVerified, coverageCodes } from "./rules";
import { validatePlan } from "./domain";
import { isDemo } from "./auth";
import type { AIPlan, BusinessState } from "./types";
import { z } from "zod";
export const PlanSchema = z
  .object({
    overviewQuestionIds: z.array(z.string()).max(100),
    coverageCodes: z.array(z.string()).max(20),
    followUpQuestionIds: z.array(z.string()).max(100),
  })
  .strict();
export async function generatePlan(
  s: BusinessState,
  useAI: boolean,
): Promise<{ plan: AIPlan; mode: "ai" | "rules"; model: string }> {
  const questions = activeQuestions(s);
  const verified = questions.filter((q) => isVerified(s, q.id));
  const fallback = {
    overviewQuestionIds: verified.map((q) => q.id),
    coverageCodes: coverageCodes(s),
    followUpQuestionIds: questions
      .filter((q) => !isVerified(s, q.id))
      .map((q) => q.id),
  };
  if (!useAI)
    return { plan: fallback, mode: "rules", model: "deterministic-rules-v1" };
  if (isDemo())
    throw new Error(
      "External AI calls are disabled in the fictional demo. Use a rules-based draft.",
    );
  if (
    process.env.AI_PROCESSING_ENABLED !== "true" ||
    !process.env.OPENAI_API_KEY
  )
    throw new Error(
      "AI processing is not configured or authorized. Use the rules-based draft.",
    );
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: 30000,
    maxRetries: 1,
  });
  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
  // No raw documents, names, locations, email addresses, or client text go to the model.
  // The model can order canonical facts and select from constrained references only.
  const response = await client.responses.create({
    model,
    store: false,
    max_output_tokens: 2000,
    instructions:
      "You organize a commercial insurance submission. Return only reference IDs from the allowed lists. Order ALL verified fact IDs for a useful overview. Coverage codes are possible considerations, not determinations. Include ALL follow-up IDs. Never invent facts, values, identifiers, or answers. No free-form factual text is permitted.",
    input: JSON.stringify({
      verifiedFacts: verified.map((q) => ({ id: q.id, label: q.label })),
      allowedCoverageCodes: fallback.coverageCodes,
      requiredFollowUpIds: fallback.followUpQuestionIds,
    }),
    text: {
      format: {
        type: "json_schema",
        name: "submission_plan",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          required: [
            "overviewQuestionIds",
            "coverageCodes",
            "followUpQuestionIds",
          ],
          properties: {
            overviewQuestionIds: { type: "array", items: { type: "string" } },
            coverageCodes: { type: "array", items: { type: "string" } },
            followUpQuestionIds: { type: "array", items: { type: "string" } },
          },
        },
      },
    },
  });
  const plan = validatePlan(
    s,
    PlanSchema.parse(JSON.parse(response.output_text)),
  );
  if (
    plan.overviewQuestionIds.length !== verified.length ||
    plan.followUpQuestionIds.length !== fallback.followUpQuestionIds.length
  )
    throw new Error("AI omitted required references. No draft was saved.");
  return { plan, mode: "ai", model };
}
