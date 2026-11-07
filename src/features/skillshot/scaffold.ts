import { skillTaxonomy } from "../../domain/skills/taxonomy";
import type { Blueprint, Proficiency, Scene } from "./types";

export type SkillShotBrief = {
  topic: string;
  skills: Array<{ skill: string; toLevel: number }>;
  audience: string;
  proficiency: Proficiency;
  role?: string;
  industry?: string;
  /** What the author knows: facts, steps, an example. The design agent works only from this and from stated method knowledge. */
  sourceNotes: string;
  contributor: string;
  sourceKind: "expert-interview" | "document" | "illustrative" | "method" | "design";
  /** A fixed address, used when a Skill Shot replaces an older one so links and progress carry over. */
  slug?: string;
  /** Set when the draft is built from a coach's published lesson: the coach's own words are the source and the coach approves the result. */
  sourceLessonId?: string;
};

export const slugOf = (text: string): string => text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "skill-shot";
export const briefSlug = (brief: Pick<SkillShotBrief, "topic" | "slug">): string => brief.slug ?? slugOf(brief.topic);

const TODO = (what: string) => `[[${what}]]`;
const names = new Map(skillTaxonomy.map((skill) => [skill.slug, skill.name]));

/**
 * The shape of a good Skill Shot with the content left to write. Used when no AI is available: it gives an author the structure
 * and the quality bar, and the rubric refuses to pass it until every [[placeholder]] is replaced.
 */
export function scaffoldBlueprint(brief: SkillShotBrief): Blueprint {
  const skillName = names.get(brief.skills[0]?.skill ?? "") ?? brief.topic;
  const scene = (id: string, section: Scene["section"], title: string, purpose: string, extra: Partial<Scene> = {}): Scene => ({
    id,
    section,
    purpose,
    title,
    onScreen: [TODO("two or three short lines, 14 words or fewer each")],
    narration: TODO(`what Arya says for ${title.toLowerCase()}: plain language, spoken, not read from the screen`),
    pauseSeconds: 3,
    cue: "point",
    accessibility: TODO("describe what is on screen for someone who cannot see it"),
    sources: ["S1"],
    ...extra,
  });
  return {
    meta: {
      id: briefSlug(brief),
      title: brief.topic,
      version: "0.1.0",
      domain: skillName,
      industry: brief.industry,
      role: brief.role,
      targetAudience: brief.audience,
      proficiency: brief.proficiency,
      language: "English (India)",
      teachingPattern: "E",
      patternReason: TODO("why this teaching pattern fits the capability and the learner"),
      prerequisites: [TODO("what a learner should already be able to do")],
      parentSkill: `${skillName} › ${brief.topic}`,
      relatedSkillShots: [],
      contributorAttribution: brief.contributor,
      reviewStatus: "draft",
      skillMap: brief.skills,
    },
    design: {
      learningNeed: TODO("the real need, in one or two sentences"),
      learningObjective: TODO("start with an observable verb: Trace, Choose, Write, Compare…"),
      successCriteria: [TODO("what a competent learner does"), TODO("a second observable criterion")],
      caseContext: TODO("a credible case with enough context to reason about"),
      keyConcept: TODO("the idea in plain language"),
      methodOrFramework: TODO("the method, step by step"),
      stepByStepApplication: [TODO("step 1"), TODO("step 2"), TODO("step 3")],
      workedExample: TODO("the case worked through"),
      commonMistakes: [TODO("a common mistake"), TODO("another common mistake")],
      limitationsAndCaveats: [TODO("where this does not apply")],
      learnerChallenge: TODO("a new, related problem that needs one decision"),
      workplaceTransferTask: TODO("a realistic task to do at work this week"),
      summaryTakeaways: [TODO("takeaway one"), TODO("takeaway two")],
      nextLearningRecommendation: [{ label: TODO("what to learn next"), why: TODO("why it follows") }],
    },
    disclosure: "Arya is an AI teacher and her voice is synthetic. This is a draft that a person has not yet reviewed.",
    scenes: [
      scene("hook", "hook", "The problem", "Show a credible problem the learner recognises.", { cue: "greet" }),
      scene("outcome", "outcome", "By the end, you can…", "State what the learner will be able to do."),
      scene("concept", "concept", "The idea", "Explain the idea in plain language with an analogy."),
      scene("method", "method", "The method", "Show the steps, decisions and common errors."),
      scene("application", "application", "Back to the case", "Apply the method to the opening case."),
      scene("challenge", "challenge", "Your turn", "Give a new problem and ask for one decision.", {
        pauseSeconds: 0,
        cue: "pause",
        interaction: {
          prompt: TODO("the decision, in one or two sentences"),
          thinkSeconds: 10,
          correctId: "b",
          rationale: TODO("why the best option is best"),
          options: ["a", "b", "c"].map((id) => ({ id, text: TODO(`option ${id}`), feedback: TODO(`why option ${id} is or is not best`) })),
        },
      }),
      scene("summary", "summary", "What to remember", "Give two to four takeaways and the work task."),
    ],
    knowledgeCheck: [1, 2].map((n) => ({ id: `q${n}`, prompt: TODO(`question ${n}`), correctId: "a", why: TODO("why"), options: ["a", "b", "c"].map((id) => ({ id, text: TODO(`option ${id}`), feedback: TODO(`feedback ${id}`) })) })),
    sources: [
      { id: "S1", kind: brief.sourceKind, label: brief.sourceKind === "illustrative" ? "Illustrative case written for this lesson" : TODO("name the source"), where: undefined },
    ],
    learningPath: { skillSet: skillName, capabilityModule: brief.topic, rolePath: brief.role ?? "General", position: TODO("where it sits in the path: before, after, and why") },
  };
}
