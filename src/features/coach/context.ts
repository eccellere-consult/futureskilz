import type { Blueprint, Scene } from "../skillshot/types";

/**
 * What Arya may draw on when she coaches inside a Skill Shot: the lesson itself and nothing else. Grounding her in the lesson keeps
 * her answers on topic and checkable. The right answer to a decision or a knowledge question is left out until the learner has
 * answered it, so a hint can never be turned into the answer by asking again.
 */
export type CoachScope = {
  /** The scene the learner is on, so "this" has a meaning. */
  sceneId?: string;
  /** Ids of decision scenes and knowledge questions the learner has already answered. */
  answered: string[];
};

const STOP = new Set("the a an and or but if then than to of in on at for with from by is are was were be been it this that these those what why how when where which who do does did can could should would will you your i me my we our they them their as not no yes just so very about into out up down more most some any".split(" "));
export const tokens = (text: string): string[] => (text.toLowerCase().match(/[a-z][a-z'-]{2,}/g) ?? []).filter((word) => !STOP.has(word));

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max).trimEnd()}…` : text);

export function lessonContext(blueprint: Blueprint, scope: CoachScope): string {
  const { meta, design, scenes, knowledgeCheck } = blueprint;
  const answered = new Set(scope.answered);
  const lines: string[] = [
    `Skill Shot: ${meta.title}`,
    `Objective: ${design.learningObjective}`,
    `Key idea: ${design.keyConcept}`,
    `Method: ${design.methodOrFramework}`,
    `Steps: ${design.stepByStepApplication.join(" | ")}`,
    `Worked example: ${design.workedExample}`,
    `Common mistakes: ${design.commonMistakes.join(" | ")}`,
    `Limits: ${design.limitationsAndCaveats.join(" | ")}`,
    `Work task: ${design.workplaceTransferTask}`,
    `Success criteria: ${design.successCriteria.join(" | ")}`,
  ];
  for (const scene of scenes) {
    lines.push(`Scene "${scene.title}" (${scene.section}): ${clip(scene.narration, 700)}`);
    if (scene.interaction) {
      const { interaction } = scene;
      lines.push(`  Decision: ${interaction.prompt}`, `  Options: ${interaction.options.map((option) => `${option.id}) ${option.text}`).join(" | ")}`);
      if (answered.has(scene.id)) lines.push(`  Learner has answered. Best option: ${interaction.correctId}. Why: ${interaction.rationale}`);
      else lines.push("  Learner has NOT answered yet: give hints only, never name the best option or say which options are wrong.");
    }
  }
  for (const question of knowledgeCheck) {
    lines.push(`Check question ${question.id}: ${question.prompt} Options: ${question.options.map((option) => `${option.id}) ${option.text}`).join(" | ")}`);
    lines.push(answered.has(question.id) ? `  Learner has answered. Best option: ${question.correctId}. Why: ${question.why}` : "  Learner has NOT answered yet: hints only, never name the best option.");
  }
  if (scope.sceneId) {
    const current = scenes.find((scene) => scene.id === scope.sceneId);
    if (current) lines.push(`The learner is now on the scene "${current.title}".`);
  }
  return lines.join("\n");
}

export const allowedLinks = (blueprint: Blueprint): string[] => blueprint.design.nextLearningRecommendation.flatMap((item) => (item.href ? [item.href] : []));

/** The scene whose words best match the question, for the plain (no-AI) coach. */
export function bestScene(blueprint: Blueprint, question: string): Scene | undefined {
  const asked = new Set(tokens(question));
  if (asked.size === 0) return undefined;
  let best: { scene: Scene; score: number } | undefined;
  for (const scene of blueprint.scenes) {
    const bag = tokens(`${scene.title} ${scene.onScreen.join(" ")} ${scene.narration}`);
    const score = bag.filter((word) => asked.has(word)).length / Math.sqrt(bag.length || 1);
    if (score > (best?.score ?? 0)) best = { scene, score };
  }
  return best && best.score >= 0.5 ? best.scene : undefined;
}
