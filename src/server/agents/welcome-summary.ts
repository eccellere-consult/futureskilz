import { z } from "zod";

import { findPriorityPillars, type PillarScore } from "../../features/assessment/model";
import { buildStarterJourney } from "../../features/journey/model";
import type { AiProvider } from "../providers/ai";
import type { AgentDefinition } from "./registry";

export const welcomeSummaryInputSchema = z.object({
  name: z.string().max(160),
  currentRole: z.string().max(160),
  goal: z.string().max(1000),
  challenge: z.string().max(2000),
  scores: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      shortName: z.string(),
      score: z.number(),
      level: z.string(),
    }),
  ),
  completedSkillShots: z.array(z.string()).default([]),
});

export const welcomeSummaryOutputSchema = z.object({
  summary: z.string().min(20).max(700),
  source: z.enum(["ai", "template"]),
});

export type WelcomeSummaryInput = z.input<typeof welcomeSummaryInputSchema>;

function nextSkillShotTitle(input: WelcomeSummaryInput): string | undefined {
  const completed = input.completedSkillShots ?? [];
  return buildStarterJourney(input.scores as PillarScore[], completed).find(({ skillShot }) => !completed.includes(skillShot.slug))
    ?.skillShot.title;
}

function asClause(goal: string): string {
  const clause = goal.trim().replace(/^(to |i want to )/i, "").replace(/\.$/, "");
  return clause.charAt(0).toLowerCase() + clause.slice(1);
}

export type WelcomeSummaryOutput = z.infer<typeof welcomeSummaryOutputSchema>;

/** Plain-language summary following the diagnostic close: heard, may mean, uncertain, next. */
export function templateWelcomeSummary(input: WelcomeSummaryInput): string {
  const scores = input.scores as PillarScore[];
  const [first, second] = findPriorityPillars(scores, 2);
  const strongest = [...scores].sort((left, right) => right.score - left.score)[0];
  const next = nextSkillShotTitle(input);
  const heard = [
    input.currentRole ? `you work as ${input.currentRole}` : null,
    input.goal ? `you want to ${asClause(input.goal)}` : null,
  ].filter(Boolean);

  return [
    heard.length ? `What I heard: ${heard.join(", and ")}.` : null,
    strongest && first
      ? `What it may mean: ${strongest.name} looks like a strength to build on, while ${first.name}${second ? ` and ${second.name}` : ""} offer the quickest gains.`
      : null,
    "What is still uncertain: these are self-reported estimates, so practice will sharpen them.",
    next ? `Next: start with "${next}".` : null,
  ]
    .filter(Boolean)
    .join(" ");
}

export function createWelcomeSummaryAgent(ai: AiProvider): AgentDefinition<WelcomeSummaryInput, WelcomeSummaryOutput> {
  return {
    name: "welcome-summary",
    version: "1",
    inputSchema: welcomeSummaryInputSchema,
    outputSchema: welcomeSummaryOutputSchema,
    costCeilingMicros: 5_000,
    requiresApproval: false,
    async execute(input) {
      const fallback = { summary: templateWelcomeSummary(input), source: "template" as const };
      if (ai.name === "deterministic") return fallback;

      try {
        const response = await ai.generate({
          temperature: 0.3,
          maxOutputTokens: 220,
          messages: [
            {
              role: "system",
              content:
                "You are Arya, the FutureSkilz learning guide. Write at most four short plain-language sentences, in this order: what I heard, what it may mean, what is still uncertain (scores are self-reported estimates, never certainties), and the next step. No headings, no lists, no flattery.",
            },
            { role: "user", content: JSON.stringify({ ...input, suggestedNextSkillShot: nextSkillShotTitle(input) }) },
          ],
        });
        const summary = response.content.trim();
        return summary.length >= 20 && summary.length <= 700 ? { summary, source: "ai" as const } : fallback;
      } catch {
        return fallback;
      }
    },
  };
}
