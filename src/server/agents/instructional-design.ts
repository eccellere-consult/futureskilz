import { z } from "zod";

import { skillTaxonomy } from "../../domain/skills/taxonomy";
import { reviewBlueprint, type Review } from "../../features/skillshot/rubric";
import { briefSlug, scaffoldBlueprint, type SkillShotBrief } from "../../features/skillshot/scaffold";
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
  sourceNotes: z.string().trim().max(24500).default(""),
  contributor: z.string().trim().min(2).max(200),
  sourceKind: z.enum(["expert-interview", "document", "illustrative", "method", "design"]),
  slug: z.string().regex(/^[a-z0-9-]{3,80}$/).optional(),
  sourceLessonId: z.string().max(40).optional(),
  sourceProjectId: z.string().max(40).optional(),
  autopilot: z.boolean().optional(),
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
- EVERY scene is one consulting-style slide with five parts. "title": an ACTION TITLE, a full sentence of at most 14 words that states the slide's conclusion (for example "A fix that treats the symptom lasts two days", never a label like "The problem" or "Introduction"). "subtitle": one line that frames it (the question answered, or the scope). "onScreen": the content lines. "visual": the picture or diagram. "takeaway": the so-what in one sentence of at most 22 words, what the learner should remember or do, different from the title. Read in order, the titles alone must tell the whole lesson.
- Narration is what Arya says aloud: short sentences, spoken. EVERY scene's narration MUST be 100 to 160 words; count them. All scenes together MUST be 750 to 1,400 spoken words. A draft with shorter narration is rejected. On-screen text is what the learner reads on the slide: 3 or 4 lines in EVERY scene, each at most 14 words, each carrying real content from the lesson (the key term and its plain meaning, a number, a step, a rule of thumb, a contrast), never a bare heading or a teaser. It must not repeat the narration word for word.
- Every scene except the challenge ALSO has a "visual" that organises the idea: a case-card for the case (heading, 3 to 5 facts, label), "steps" for a method (3 to 6 items), "compare" for right against wrong or before against after (leftTitle, rightTitle, rows of [label, left, right]), "why-chain" for causes (problem, links of {why, because}, root), "checklist" for what to check (title, items), "takeaways" for the summary (items). And five DIAGRAMS, which are drawn as real illustrations, so prefer them wherever they fit: "flow" for a sequence or a process (items: 2 to 6 short boxes joined by arrows), "cycle" for something that repeats (items: 3 to 6 short stages, optional "centre"), "matrix" for two factors that give four situations (xAxis, yAxis, cells: EXACTLY 4 of {title, text} in the order top-left, top-right, bottom-left, bottom-right, where top is high on the yAxis and right is high on the xAxis), "bars" ONLY for numbers that are in the notes (title, unit, bars of {label, value}), "timeline" for dated events in the notes (items of {when, what}), "hexagon" for one idea made of three to six parts that belong together (centre: the idea in at most 4 words; items: 3 to 6 parts, each at most 5 words), "roadmap" for a plan over time (phases: 2 to 5 of {when, title, text}, the last one is the goal), "pyramid" for levels that build on each other (levels: 3 to 5, top first, the top is the aim), "funnel" for stages where fewer pass each time (stages: 3 to 5 of {label, value?}, value only if it is in the notes). CHOOSE THE DIAGRAM THAT MAKES THE POINT VISIBLE: two factors, four situations is a matrix; parts of a whole is a hexagon; a plan over time is a roadmap; a sequence is a flow; a loop is a cycle; a hierarchy is a pyramid; narrowing is a funnel; right against wrong is a compare. Use a plain list (steps, checklist, case-card) only when no diagram fits. Use at least three diagrams and at least four different visual types across the lesson. Never put an invented number in a diagram. Each scene also has a one-sentence "purpose" in the learner's words.
- Total spoken length across scenes must be about 5 to 10 minutes at 145 words a minute.
- Add 2 or 3 knowledge-check questions with explained options, a workplace task for this week, 2 to 4 takeaways and what to learn next.
- SOURCE INTEGRITY: use ONLY the author's notes for facts about a real organisation, person, number or result. Do not invent statistics, companies, quotes or experiences. If the notes lack a case, write a clearly illustrative case, set its source kind to "illustrative", and label the case card "Illustrative case, written for this lesson". Every scene lists the source ids it relies on. Name the limits of the method.
- The disclosure must say that Arya is an AI and the voice is synthetic, and that this is a draft not yet reviewed by a person.
- reviewStatus is always "draft". Language is English (India). Be respectful of adult learners; no flattery.

Reply with ONE JSON object only, no commentary, with exactly this shape:
{"meta":{"id","title","version":"0.1.0","domain","industry?","functionName?","role?","targetAudience","proficiency":"foundational|working|advanced","language","teachingPattern":"A|B|C|D|E|F","patternReason","prerequisites":[],"parentSkill","relatedSkillShots":[],"contributorAttribution","reviewStatus":"draft","skillMap":[{"skill","toLevel"}]},
"design":{"learningNeed","learningObjective","successCriteria":[],"caseContext","keyConcept","methodOrFramework","stepByStepApplication":[],"workedExample","commonMistakes":[],"limitationsAndCaveats":[],"learnerChallenge","workplaceTransferTask","summaryTakeaways":[],"nextLearningRecommendation":[{"label","why"}]},
"disclosure","scenes":[{"id","section","purpose","title","subtitle","takeaway","onScreen":[],"visual?":{"type":"case-card|compare|steps|why-chain|checklist|takeaways|flow|cycle|matrix|bars|timeline|hexagon|roadmap|pyramid|funnel",...},"narration","pauseSeconds","cue":"greet|point|pause|none","interaction?":{"prompt","context?","options":[{"id","text","feedback"}],"correctId","thinkSeconds","rationale"},"accessibility","sources":["S1"]}],
"knowledgeCheck":[{"id","prompt","options":[{"id","text","feedback"}],"correctId","why"}],
"sources":[{"id":"S1","kind":"illustrative|method|product|design|expert-interview|document","label"}],
"learningPath":{"skillSet","capabilityModule","rolePath","position"}}`;

/** What the model may not decide: identity, review status, the skill map and the attribution come from the brief. */
function pinToBrief(blueprint: Blueprint, brief: SkillShotBrief): Blueprint {
  return {
    ...blueprint,
    meta: { ...blueprint.meta, id: briefSlug(brief), version: "0.1.0", reviewStatus: "draft", skillMap: brief.skills, contributorAttribution: brief.contributor, targetAudience: blueprint.meta.targetAudience || brief.audience, proficiency: brief.proficiency },
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

      const fromLesson = Boolean(brief.sourceLessonId || brief.sourceProjectId);
      const user = JSON.stringify({
        brief: { ...brief, sourceNotes: undefined, sourceLessonId: undefined, sourceProjectId: undefined },
        authorNotes: brief.sourceNotes || "(none: write a clearly illustrative case)",
        ...(fromLesson ? { contributorWords: "The notes are a coach's own words from an approved lesson. Keep their key sentences in the narration where you can, in their meaning and order. Add the plain-language structure, the decision and the check, but add NO fact, number, name or experience that is not in the notes. Set the source kind to expert-interview and label the source with the credit line." } : {}),
      });
      const notes: string[] = [];
      let previous: string | null = null;
      let problems: string[] = [];
      let best: { blueprint: Blueprint; review: Review } | null = null;

      for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
          const messages = [
            { role: "system" as const, content: SYSTEM },
            { role: "user" as const, content: user },
            ...(previous ? [{ role: "assistant" as const, content: previous }, { role: "user" as const, content: `Repair this draft. Fix every point and return the complete JSON again:\n- ${problems.join("\n- ")}` }] : []),
          ];
          const response = await ai.generate({ temperature: 0.4, maxOutputTokens: 16000, messages });
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
          const spoken = blueprint.scenes.map((scene) => scene.narration.split(/\s+/).filter(Boolean).length);
          const total = spoken.reduce((sum, count) => sum + count, 0);
          // The most common fault is narration that is far too short: say exactly how short, scene by scene, so the repair is concrete.
          problems = total < 700 ? [...review.blockers, `The narration is ${total} words in all (scene by scene: ${spoken.join(", ")}). Rewrite EVERY scene's narration to 100 to 160 words of real teaching from the notes, 750 words or more in all, and keep everything else.`] : review.blockers;
          notes.push(`Attempt ${attempt}: ${review.blockers.length} point${review.blockers.length === 1 ? "" : "s"} to fix.`);
        } catch {
          notes.push(`Attempt ${attempt}: the AI service did not answer.`);
          break;
        }
      }
      if (best) return { ...best, source: "ai" as const, attempts: 3, notes: [...notes, "Kept the closest draft. A person needs to fix the remaining points."] };
      const fallback = scaffold();
      return { ...fallback, notes: [...notes, "The AI's replies could not be used, so this is only the empty structure. Run it again."] };
    },
  };
}
