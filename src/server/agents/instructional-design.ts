import { z } from "zod";

import { skillTaxonomy } from "../../domain/skills/taxonomy";
import { reviewBlueprint, type Review } from "../../features/skillshot/rubric";
import { scaffoldBlueprint, slugOf, type SkillShotBrief } from "../../features/skillshot/scaffold";
import { parseBlueprint } from "../../features/skillshot/schema";
import type { Blueprint } from "../../features/skillshot/types";
import type { AiProvider } from "../providers/ai";
import type { AgentDefinition } from "./registry";

/**
 * Instructional Design Agent. Turns a brief and the author's own notes into a Skill Shot blueprint that follows the
 * FutureSkilz instructional design skill (docs/skill-shots/skill.md), then checks it against the automatic rubric and, if it
 * falls short, asks the model to repair it once. The result is always a DRAFT: the rubric checks structure, not teaching quality,
 * so a person reviews it before any learner sees it. With no AI available it returns the structure with placeholders to write.
 */
const known = new Set(skillTaxonomy.map((skill) => skill.slug));

export const briefSchema = z.object({
  topic: z.string().trim().min(4).max(160),
  skills: z.array(z.object({ skill: z.string().refine((slug) => known.has(slug), "Unknown skill"), toLevel: z.number().min(0.5).max(5) })).min(1).max(4),
  audience: z.string().trim().min(4).max(300),
  proficiency: z.enum(["foundational", "working", "advanced"]),
  role: z.string().trim().max(160).optional(),
  industry: z.string().trim().max(120).optional(),
  sourceNotes: z.string().trim().max(8000).default(""),
  contributor: z.string().trim().min(2).max(200),
  sourceKind: z.enum(["expert-interview", "document", "illustrative", "method"]),
});

export const designOutputSchema = z.object({
  blueprint: z.custom<Blueprint>(),
  review: z.custom<Review>(),
  source: z.enum(["ai", "scaffold"]),
  attempts: z.number(),
  notes: z.array(z.string()),
});
export type DesignOutput = z.infer<typeof designOutputSchema>;

const SYSTEM = `You are the FutureSkilz Instructional Design Agent. You design one Skill Shot: a 5 to 10 minute lesson taught by Arya, an AI teacher, on ONE capability.

Follow these rules exactly.
- Start from a real need. Give the learner an observable outcome that begins with a verb (trace, choose, write, compare, decide, diagnose, map, apply...).
- Explain in plain language first, with one analogy, then give the proper term. Demonstrate the method step by step on a case, then give the learner a NEW related problem with one decision.
- Use six to nine scenes with these sections in order: hook, outcome, concept, method, application, challenge, summary. The hook shows the problem. The application returns to the same case. The challenge scene has an interaction with 3 options, a thinking pause of at least 5 seconds, feedback that explains EVERY option, and a rationale.
- Narration is what Arya says aloud: short sentences, spoken, 90 to 160 words per scene. On-screen text is short (at most 14 words a line, at most 4 lines) and must not repeat the narration.
- Total spoken length across scenes must be about 5 to 10 minutes at 145 words a minute.
- Add 2 or 3 knowledge-check questions with explained options, a workplace task for this week, 2 to 4 takeaways and what to learn next.
- SOURCE INTEGRITY: use ONLY the author's notes for facts about a real organisation, person, number or result. Do not invent statistics, companies, quotes or experiences. If the notes lack a case, write a clearly illustrative case, set its source kind to "illustrative", and label the case card "Illustrative case, written for this lesson". Every scene lists the source ids it relies on. Name the limits of the method.
- The disclosure must say that Arya is an AI and the voice is synthetic, and that this is a draft not yet reviewed by a person.
- reviewStatus is always "draft". Language is English (India). Be respectful of adult learners; no flattery.

Reply with ONE JSON object only, no commentary, with exactly this shape:
{"meta":{"id","title","version":"0.1.0","domain","industry?","functionName?","role?","targetAudience","proficiency":"foundational|working|advanced","language","teachingPattern":"A|B|C|D|E|F","patternReason","prerequisites":[],"parentSkill","relatedSkillShots":[],"contributorAttribution","reviewStatus":"draft","skillMap":[{"skill","toLevel"}]},
"design":{"learningNeed","learningObjective","successCriteria":[],"caseContext","keyConcept","methodOrFramework","stepByStepApplication":[],"workedExample","commonMistakes":[],"limitationsAndCaveats":[],"learnerChallenge","workplaceTransferTask","summaryTakeaways":[],"nextLearningRecommendation":[{"label","why"}]},
"disclosure","scenes":[{"id","section","purpose","title","onScreen":[],"visual?":{"type":"case-card|compare|steps|why-chain|checklist|takeaways",...},"narration","pauseSeconds","cue":"greet|point|pause|none","interaction?":{"prompt","context?","options":[{"id","text","feedback"}],"correctId","thinkSeconds","rationale"},"accessibility","sources":["S1"]}],
"knowledgeCheck":[{"id","prompt","options":[{"id","text","feedback"}],"correctId","why"}],
"sources":[{"id":"S1","kind":"illustrative|method|product|design|expert-interview|document","label"}],
"learningPath":{"skillSet","capabilityModule","rolePath","position"}}`;

/** What the model may not decide: identity, review status, the skill map and the attribution come from the brief. */
function pinToBrief(blueprint: Blueprint, brief: SkillShotBrief): Blueprint {
  return {
    ...blueprint,
    meta: { ...blueprint.meta, id: slugOf(brief.topic), version: "0.1.0", reviewStatus: "draft", skillMap: brief.skills, contributorAttribution: brief.contributor, targetAudience: blueprint.meta.targetAudience || brief.audience, proficiency: brief.proficiency },
  };
}

export function createInstructionalDesignAgent(ai: AiProvider): AgentDefinition<SkillShotBrief, DesignOutput> {
  return {
    name: "instructional-design",
    version: "1",
    inputSchema: briefSchema as unknown as z.ZodType<SkillShotBrief>,
    outputSchema: designOutputSchema,
    costCeilingMicros: 60_000,
    requiresApproval: true,
    async execute(brief) {
      const scaffold = () => {
        const blueprint = scaffoldBlueprint(brief);
        return { blueprint, review: reviewBlueprint(blueprint), source: "scaffold" as const, attempts: 0, notes: ["No AI is configured, so this is the structure with placeholders to write. The checks will not pass until each [[placeholder]] is replaced."] };
      };
      if (ai.name === "deterministic") return scaffold();

      const user = JSON.stringify({ brief: { ...brief, sourceNotes: undefined }, authorNotes: brief.sourceNotes || "(none: write a clearly illustrative case)" });
      const notes: string[] = [];
      let previous: string | null = null;
      let problems: string[] = [];
      let best: { blueprint: Blueprint; review: Review } | null = null;

      for (let attempt = 1; attempt <= 2; attempt += 1) {
        try {
          const messages = [
            { role: "system" as const, content: SYSTEM },
            { role: "user" as const, content: user },
            ...(previous ? [{ role: "assistant" as const, content: previous }, { role: "user" as const, content: `Repair this draft. Fix every point and return the complete JSON again:\n- ${problems.join("\n- ")}` }] : []),
          ];
          const response = await ai.generate({ temperature: 0.4, maxOutputTokens: 7000, messages });
          previous = response.content;
          const parsed = parseBlueprint(response.content);
          if (!parsed.ok) {
            problems = parsed.errors;
            notes.push(`Attempt ${attempt}: the reply did not match the blueprint format (${parsed.errors[0]}).`);
            continue;
          }
          const blueprint = pinToBrief(parsed.blueprint, brief);
          const review = reviewBlueprint(blueprint);
          if (!best || review.blockers.length < best.review.blockers.length) best = { blueprint, review };
          if (review.passes) return { ...best, source: "ai" as const, attempts: attempt, notes };
          problems = review.blockers;
          notes.push(`Attempt ${attempt}: ${review.blockers.length} point${review.blockers.length === 1 ? "" : "s"} to fix.`);
        } catch {
          notes.push(`Attempt ${attempt}: the AI service did not answer.`);
          break;
        }
      }
      if (best) return { ...best, source: "ai" as const, attempts: 2, notes: [...notes, "Kept the closest draft. A person needs to fix the remaining points."] };
      const fallback = scaffold();
      return { ...fallback, notes: [...notes, ...fallback.notes] };
    },
  };
}
