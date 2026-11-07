import { describe, expect, it } from "vitest";

import { cleanAnswers, diagnosticBodySchema } from "./validate";

describe("cleanAnswers", () => {
  it("keeps real answers once, and drops unknown questions, impossible options and results on a skipped question", () => {
    const out = cleanAnswers([
      { questionId: "think-recurring-problem", option: 2, outcome: 1 },
      { questionId: "think-recurring-problem", option: 3 },
      { questionId: "nope", option: 1 },
      { questionId: "ai-recent-use", option: 9 },
      { questionId: "self-sudden-change", option: null, outcome: 2 },
      { questionId: "people-outside-authority", option: 1, outcome: 9 },
    ]);
    expect(out).toEqual([
      { questionId: "think-recurring-problem", option: 2, outcome: 1 },
      { questionId: "self-sudden-change", option: null },
      { questionId: "people-outside-authority", option: 1 },
    ]);
  });
  it("limits the body", () => {
    expect(diagnosticBodySchema.safeParse({ answers: Array.from({ length: 17 }, () => ({ questionId: "x", option: 0 })) }).success).toBe(false);
  });
});
