import "server-only";

import { buildExtractionMessages, parseJsonLoose, validateAiFacts, type DraftFact, type Rejection } from "@/features/capture/extraction";
import type { QuestionDef } from "@/features/capture/question-bank";
import type { Segment } from "@/features/capture/types";
import { createProviders } from "@/server/providers";

/**
 * The optional AI reader. It runs only when a real provider is configured; with none (or on any failure) the caller keeps
 * the rule-based facts, so the interview never depends on a model being available. Whatever the model returns is checked
 * against the segments it was shown (see validateAiFacts): an ungrounded claim is dropped and counted, never saved.
 */
export type AiReading = { facts: DraftFact[]; rejected: Rejection[]; provider: string; model: string };

const TIMEOUT_MS = 20_000;

/** The demo seeder switches the model off so sample content is identical every time and costs nothing. */
export const aiSwitch = { off: false };

export async function readWithAi(input: { segments: Segment[]; question: QuestionDef | null; roleId: string | null; processId: string | null }): Promise<AiReading | null> {
  if (aiSwitch.off) return null;
  try {
    const { ai } = createProviders();
    if (ai.name === "deterministic") return null;
    const messages = buildExtractionMessages({ segments: input.segments, question: input.question?.text ?? null, categories: input.question?.produces ?? [] });
    const response = await Promise.race([
      ai.generate({ messages, temperature: 0.1, maxOutputTokens: 1400 }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("AI extraction timed out.")), TIMEOUT_MS)),
    ]);
    if (response.provider === "deterministic") return null;
    const { accepted, rejected } = validateAiFacts(parseJsonLoose(response.content), input.segments, { roleId: input.roleId, processId: input.processId });
    return { facts: accepted, rejected, provider: response.provider, model: response.model };
  } catch (error) {
    console.warn("[capture] AI reading skipped:", error instanceof Error ? error.message : error);
    return null;
  }
}
