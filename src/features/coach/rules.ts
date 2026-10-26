import { bestScene, type CoachScope } from "./context";
import { EMPTY_REPLY } from "./safety";
import type { Blueprint } from "../skillshot/types";

/**
 * The coach without an AI. It answers from the lesson with fixed rules: an idea, the steps, an example, a hint, the work task.
 * It is plainer than the AI coach and says so, but it never invents anything, never reveals an unanswered check, and always works.
 */
export type CoachReply = { reply: string; suggestions: string[] };

const SUGGESTIONS = ["Explain the main idea", "Show me the steps", "Give me an example", "Give me a hint", "What should I do at work?"];

const first = (text: string, sentences = 2) => (text.match(/[^.!?]+[.!?]+/g) ?? [text]).slice(0, sentences).join(" ").trim();

export function ruleReply(blueprint: Blueprint, message: string, scope: CoachScope): CoachReply {
  const text = message.toLowerCase();
  const { design } = blueprint;
  const scene = scope.sceneId ? blueprint.scenes.find((item) => item.id === scope.sceneId) : undefined;
  const withTeachBack = (body: string, prompt: string) => ({ reply: `${body} ${prompt}`, suggestions: SUGGESTIONS });

  if (/\b(hint|stuck|help me (choose|decide)|which (one|option)|not sure|no idea|don'?t know)\b/.test(text)) {
    const pending = scene?.interaction && !scope.answered.includes(scene.id);
    if (pending) {
      return withTeachBack(
        `Here is a way to think about it, without giving the answer. The method is: ${first(design.methodOrFramework, 1)} Check each option against that. Also watch for this common mistake: ${design.commonMistakes[0] ?? "jumping to a conclusion"}`,
        "Which option can you check with facts, and which depends on a guess?",
      );
    }
    return withTeachBack(`A good way in: ${first(design.keyConcept, 1)}`, "Can you say that in your own words, with one example from your work?");
  }
  if (/\b(example|case|instance|show me)\b/.test(text)) return withTeachBack(`Here is the example from this lesson. ${first(design.workedExample, 3)}`, "Where in your own work could the same thing happen?");
  if (/\b(step|steps|how do i|method|process|procedure|order)\b/.test(text)) {
    return withTeachBack(`The steps are: ${design.stepByStepApplication.slice(0, 6).join(" ")}`, "Which step would you find hardest, and why?");
  }
  if (/\b(work|task|apply|practice|use (it|this)|this week|next)\b/.test(text)) return withTeachBack(`Your task for work: ${design.workplaceTransferTask}`, "What is the first small thing you could do tomorrow?");
  if (/\b(mistake|wrong|error|avoid|pitfall)\b/.test(text)) return withTeachBack(`Common mistakes: ${design.commonMistakes.slice(0, 3).join(" ")}`, "Which of these have you seen at work?");
  if (/\b(limit|limits|caveat|when (not|doesn'?t)|doesn'?t work)\b/.test(text)) return withTeachBack(`Keep in mind: ${design.limitationsAndCaveats.slice(0, 2).join(" ")}`, "When would this not fit your situation?");
  if (/\b(idea|concept|mean|means|meaning|explain|what is|what's|why|understand|confus\w*|simple|plain)\b/.test(text)) {
    const matched = bestScene(blueprint, message);
    // "Explain" alone says nothing about the lesson: it must name the lesson, or match something in it.
    const aboutLesson = Boolean(matched) || /\b(idea|concept|lesson|this|main|point|it|that)\b/.test(text);
    if (aboutLesson) {
      const body = matched && matched.section !== "challenge" ? first(matched.narration, 3) : first(design.keyConcept, 2);
      return withTeachBack(`In plain words: ${body}`, "Now try it: how would you explain this to a colleague in two sentences?");
    }
  }
  const matched = bestScene(blueprint, message);
  if (matched && matched.section !== "challenge") return withTeachBack(`This is how the lesson covers it. ${first(matched.narration, 3)}`, "Does that answer it? Tell me what is still unclear.");
  return { reply: `${EMPTY_REPLY} I can help with the idea, the steps, an example, a hint for the decision, mistakes to avoid, or your work task.`, suggestions: SUGGESTIONS };
}

export const COACH_SUGGESTIONS = SUGGESTIONS;
