import { z } from "zod";

import type { DiagnosticAnswer } from "./engine";
import { OUTCOME_OPTIONS, questionById } from "./questions";

/** What a browser may send. Option numbers are checked against the real question, so a made-up answer cannot become evidence. */
const answerSchema = z.object({ questionId: z.string().max(60), option: z.number().int().min(0).max(9).nullable(), outcome: z.number().int().min(0).max(9).optional() });
export const diagnosticBodySchema = z.object({ answers: z.array(answerSchema).max(16), complete: z.boolean().default(false) });

export function cleanAnswers(raw: Array<z.infer<typeof answerSchema>>): DiagnosticAnswer[] {
  const seen = new Set<string>();
  const out: DiagnosticAnswer[] = [];
  for (const item of raw) {
    const question = questionById(item.questionId);
    if (!question || seen.has(item.questionId)) continue;
    if (item.option !== null && item.option >= question.options.length) continue;
    const outcome = item.outcome !== undefined && item.option !== null && item.outcome < OUTCOME_OPTIONS.length ? item.outcome : undefined;
    seen.add(item.questionId);
    out.push({ questionId: item.questionId, option: item.option, ...(outcome !== undefined ? { outcome } : {}) });
  }
  return out;
}
