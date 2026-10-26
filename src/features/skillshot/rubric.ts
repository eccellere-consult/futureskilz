import { totalSeconds, wordCount } from "./duration";
import type { Blueprint } from "./types";

/**
 * The automatic part of the quality review in the instructional design skill (section 12). It checks what a program can check:
 * structure, timing, interaction, sources, disclosure and accessibility. It cannot judge whether the teaching is *good*; that needs a
 * person, so a blueprint that passes here is still a draft until someone reviews and approves it.
 */

export const OBSERVABLE_VERBS = ["trace", "explain", "build", "calculate", "compare", "conduct", "write", "choose", "diagnose", "map", "apply", "list", "identify", "draft", "decide", "prioritise", "prioritize", "classify", "interpret", "use"];

export type Criterion =
  | "relevance"
  | "outcome clarity"
  | "accuracy and sources"
  | "explanation"
  | "demonstration"
  | "case integration"
  | "active learning"
  | "transfer"
  | "pacing and cognitive load"
  | "media and accessibility"
  | "rights and privacy"
  | "curriculum fit";

export type Finding = { criterion: Criterion; score: 1 | 2 | 3 | 4 | 5; notes: string[]; critical: string[] };
export type Review = { findings: Finding[]; blockers: string[]; passes: boolean; humanReviewRequired: true; durationMinutes: number };

const overlap = (a: string, b: string): number => {
  const bag = new Set(a.toLowerCase().match(/[a-z']+/g) ?? []);
  const words = b.toLowerCase().match(/[a-z']+/g) ?? [];
  return words.length ? words.filter((word) => bag.has(word)).length / words.length : 0;
};

export function reviewBlueprint(blueprint: Blueprint): Review {
  const { meta, design, scenes } = blueprint;
  const sourceIds = new Set(blueprint.sources.map((source) => source.id));
  const minutes = totalSeconds(blueprint) / 60;
  const findings: Finding[] = [];
  const add = (criterion: Criterion, checks: Array<[boolean, string]>, critical: string[] = []) => {
    const failed = checks.filter(([ok]) => !ok).map(([, note]) => note);
    const score = Math.max(1, 5 - failed.length - critical.length * 2) as 1 | 2 | 3 | 4 | 5;
    findings.push({ criterion, score, notes: failed, critical });
  };

  add("relevance", [[design.learningNeed.length > 40, "State the real need in a sentence or two."], [design.caseContext.length > 60, "Give the case enough context to reason about."], [scenes[0]?.section === "hook", "Begin with a hook that shows the problem."]]);

  const verb = design.learningObjective.trim().split(/\s+/)[0]?.toLowerCase().replace(/[^a-z]/g, "") ?? "";
  add("outcome clarity", [[OBSERVABLE_VERBS.includes(verb), `The objective should start with an observable verb (found "${verb}").`], [design.successCriteria.length >= 2, "List at least two success criteria."], [scenes.some((scene) => scene.section === "outcome"), "Include a scene that states the outcome."]]);

  const claimScenes = scenes.filter((scene) => scene.section !== "outcome" || scene.sources.length === 0);
  const unsourced = scenes.filter((scene) => scene.sources.length === 0).map((scene) => scene.id);
  const unknown = scenes.flatMap((scene) => scene.sources.filter((id) => !sourceIds.has(id)).map((id) => `${scene.id}:${id}`));
  const caseUnlabelled = scenes.some((scene) => scene.visual?.type === "case-card" && !scene.visual.label?.toLowerCase().includes("illustrative")) && blueprint.sources.some((source) => source.kind === "illustrative");
  add(
    "accuracy and sources",
    [[unknown.length === 0, `Unknown source ids: ${unknown.join(", ")}.`], [claimScenes.length >= 0, ""]].filter(([, note]) => note !== "") as Array<[boolean, string]>,
    [...(unsourced.length ? [`Scenes without a source: ${unsourced.join(", ")}.`] : []), ...(caseUnlabelled ? ["An illustrative case is not labelled as illustrative."] : [])],
  );

  add("explanation", [[scenes.some((scene) => scene.section === "concept"), "Include a concept scene."], [design.keyConcept.length > 60, "Explain the key concept in plain language."]]);
  add("demonstration", [[scenes.some((scene) => scene.section === "method"), "Include a method scene."], [design.stepByStepApplication.length >= 3, "Show the method step by step."], [design.commonMistakes.length >= 2, "Name common mistakes."]]);
  add("case integration", [[scenes.some((scene) => scene.section === "application"), "Return to the case and apply the method."], [scenes.some((scene) => scene.visual?.type === "why-chain" || scene.visual?.type === "case-card"), "Use a visual that carries the case."]]);

  const interactive = scenes.filter((scene) => scene.interaction);
  const feedbackOk = interactive.every((scene) => scene.interaction!.options.every((option) => option.feedback.length > 20) && scene.interaction!.rationale.length > 20);
  add("active learning", [[interactive.length >= 1, "Include at least one decision for the learner."], [feedbackOk, "Explain every option, not only the right one."], [interactive.every((scene) => scene.interaction!.thinkSeconds >= 5), "Give thinking time."], [blueprint.knowledgeCheck.length >= 2, "Add a short knowledge check."]]);
  // Learning by doing is the point of a Skill Shot: with no decision for the learner at all, the lesson cannot score well here.
  if (interactive.length === 0) findings[findings.length - 1].score = 2;
  add("transfer", [[design.workplaceTransferTask.length > 60, "Give a realistic workplace task."], [design.summaryTakeaways.length >= 2 && design.summaryTakeaways.length <= 4, "Give two to four takeaways."], [design.nextLearningRecommendation.length >= 1, "Say what to learn next."]]);

  const longScreen = scenes.filter((scene) => scene.onScreen.some((line) => wordCount(line) > 14) || wordCount(scene.onScreen.join(" ")) > 45).map((scene) => scene.id);
  const reads = scenes.filter((scene) => scene.onScreen.length && overlap(scene.onScreen.join(" "), scene.narration) > 0.97).map((scene) => scene.id);
  add(
    "pacing and cognitive load",
    [[scenes.length >= 6 && scenes.length <= 9, "Use six to nine scenes."], [longScreen.length === 0, `Shorten the on-screen text in: ${longScreen.join(", ")}.`], [reads.length === 0, `The avatar reads exactly what is on screen in: ${reads.join(", ")}.`]],
    minutes < 5 || minutes > 10 ? [`Estimated length is ${minutes.toFixed(1)} minutes; aim for 5 to 10.`] : [],
  );

  add("media and accessibility", [[scenes.every((scene) => scene.accessibility.length > 20), "Describe every visual for accessibility."], [scenes.every((scene) => scene.narration.length > 30), "Every scene needs narration, which becomes the captions."]]);

  add(
    "rights and privacy",
    [[meta.contributorAttribution.length > 5, "Record the attribution."], [meta.reviewStatus === "draft" || meta.reviewStatus === "in_review", "A blueprint made by a program must not claim to be approved or published."]],
    /AI|synthetic/i.test(blueprint.disclosure) ? [] : ["Disclose that Arya is an AI and the voice is synthetic."],
  );

  add("curriculum fit", [[meta.prerequisites.length >= 1, "Name the prerequisite."], [meta.relatedSkillShots.length >= 1 || design.nextLearningRecommendation.length >= 1, "Link related lessons."], [blueprint.learningPath.position.length > 10, "Say where it sits in the learning path."], [meta.parentSkill.length > 3, "Name the parent skill."]]);

  const blockers = findings.flatMap((finding) => finding.critical.map((note) => `${finding.criterion}: ${note}`));
  const weak = findings.filter((finding) => finding.score < 4).map((finding) => `${finding.criterion}: scored ${finding.score}`);
  return { findings, blockers: [...blockers, ...weak], passes: blockers.length === 0 && weak.length === 0, humanReviewRequired: true, durationMinutes: Number(minutes.toFixed(1)) };
}
