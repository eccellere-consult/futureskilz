import { describe, expect, it } from "vitest";

import { scoreAssessment } from "../../features/assessment/model";
import { DeterministicAiProvider, type AiProvider } from "../providers/ai";
import { createWelcomeSummaryAgent, templateWelcomeSummary, type WelcomeSummaryInput } from "./welcome-summary";

const input: WelcomeSummaryInput = {
  name: "Priya",
  currentRole: "Operations manager",
  goal: "Make faster, better-evidenced decisions.",
  challenge: "Choosing between suppliers.",
  scores: scoreAssessment({
    "digital-fluency": 0,
    "critical-thinking": 1,
    creativity: 2,
    "human-skills": 3,
    "adaptive-leadership": 2,
  }),
};

function providerReturning(content: string | Error): AiProvider {
  return {
    name: "openai",
    model: "test-model",
    async generate() {
      if (content instanceof Error) throw content;
      return { content, provider: "openai", model: "test-model", usage: { inputTokens: 1, outputTokens: 1, costMicros: 0 } };
    },
  };
}

describe("welcome summary", () => {
  it("follows heard, may mean, uncertain, next and labels estimates honestly", () => {
    const summary = templateWelcomeSummary(input);
    expect(summary).toContain("What I heard: you work as Operations manager. You want to make faster, better-evidenced decisions.");
    expect(summary).toContain("Human Skills looks like a strength");
    expect(summary).toContain("Digital Fluency and Critical Thinking offer the quickest gains");
    expect(summary).toContain("self-reported estimates");
    expect(summary).toContain('Next: start with "Use AI to sharpen a decision".');
  });

  it("points to the next Skill Shot the learner has not completed", () => {
    expect(templateWelcomeSummary({ ...input, completedSkillShots: ["ai-decision-brief"] })).toContain(
      'Next: start with "Test the assumption underneath".',
    );
  });

  it("uses the template with the deterministic provider or when the AI fails", async () => {
    await expect(createWelcomeSummaryAgent(new DeterministicAiProvider()).execute(input, {})).resolves.toMatchObject({ source: "template" });
    await expect(createWelcomeSummaryAgent(providerReturning(new Error("429"))).execute(input, {})).resolves.toMatchObject({ source: "template" });
    await expect(createWelcomeSummaryAgent(providerReturning("too short")).execute(input, {})).resolves.toMatchObject({ source: "template" });
  });

  it("returns the AI summary when a real provider answers", async () => {
    const text = "I heard you want faster decisions. Thinking looks like your quickest gain. These are early self-reported estimates. Start with the assumption test.";
    await expect(createWelcomeSummaryAgent(providerReturning(text)).execute(input, {})).resolves.toEqual({ summary: text, source: "ai" });
  });
});
