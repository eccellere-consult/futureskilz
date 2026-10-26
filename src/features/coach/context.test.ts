import { describe, expect, it } from "vitest";

import { rootCauseSkillShot as bp } from "../skillshot/samples/root-cause";
import { allowedLinks, bestScene, lessonContext } from "./context";
import { ruleReply } from "./rules";

const challenge = bp.scenes.find((scene) => scene.interaction)!;
const correct = challenge.interaction!.options.find((option) => option.id === challenge.interaction!.correctId)!;

describe("what Arya may draw on", () => {
  it("is the lesson, and holds back the best option until the learner has answered", () => {
    const before = lessonContext(bp, { answered: [] });
    expect(before).toContain(bp.design.keyConcept);
    expect(before).toContain("NOT answered yet");
    expect(before).not.toContain(`Best option: ${challenge.interaction!.correctId}`);
    expect(before).not.toContain(challenge.interaction!.rationale);
    expect(before).not.toContain(bp.knowledgeCheck[0].why);

    const after = lessonContext(bp, { answered: [challenge.id, bp.knowledgeCheck[0].id] });
    expect(after).toContain(`Best option: ${challenge.interaction!.correctId}`);
    expect(after).toContain(challenge.interaction!.rationale);
    expect(after).toContain(bp.knowledgeCheck[0].why);
    // Only the answered question is opened up.
    expect(after).not.toContain(bp.knowledgeCheck[1].why);
  });
  it("lists only the links the lesson itself offers", () => {
    expect(allowedLinks(bp)).toEqual(bp.design.nextLearningRecommendation.flatMap((item) => (item.href ? [item.href] : [])));
  });
  it("finds the scene that best matches a question, and none for unrelated words", () => {
    expect(bestScene(bp, "what is a root cause versus a symptom")?.section).toBe("concept");
    expect(bestScene(bp, "banana helicopter")).toBeUndefined();
  });
});

describe("the coach without an AI", () => {
  const scope = { sceneId: challenge.id, answered: [] as string[] };
  it("gives a hint for an unanswered decision without naming or ruling out an option", () => {
    const r = ruleReply(bp, "I am stuck, can you give me a hint?", scope);
    expect(r.reply).toMatch(/without giving the answer/);
    expect(r.reply).not.toContain(correct.text);
    for (const option of challenge.interaction!.options) expect(r.reply).not.toContain(option.text);
    expect(r.reply).not.toContain(challenge.interaction!.rationale);
    expect(r.reply.endsWith("?")).toBe(true);
  });
  it("every reply ends by asking the learner to try it in their own words", () => {
    for (const q of ["explain the idea", "show me an example", "what are the steps", "what should I do at work", "what mistakes to avoid", "when does this not work"]) {
      const r = ruleReply(bp, q, { answered: [] });
      expect(r.reply.trim().endsWith("?"), q).toBe(true);
      expect(r.suggestions.length).toBeGreaterThan(2);
    }
  });
  it("answers from the lesson, and says what it can help with when it has nothing", () => {
    expect(ruleReply(bp, "show me an example", { answered: [] }).reply).toContain("packing line");
    expect(ruleReply(bp, "what is the weather in Pune", { answered: [] }).reply).toMatch(/I can help with/);
  });
});
