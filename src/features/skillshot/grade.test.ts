import { describe, expect, it } from "vitest";

import { gradeKnowledgeCheck } from "./grade";
import { rootCauseSkillShot } from "./samples/root-cause";

const ids = rootCauseSkillShot.knowledgeCheck;

describe("gradeKnowledgeCheck", () => {
  it("passes with enough correct answers and fails otherwise", () => {
    const right = Object.fromEntries(ids.map((q) => [q.id, q.correctId]));
    expect(gradeKnowledgeCheck(rootCauseSkillShot, right)).toMatchObject({ correct: ids.length, passed: true });
    const wrong = Object.fromEntries(ids.map((q) => [q.id, "zzz"]));
    expect(gradeKnowledgeCheck(rootCauseSkillShot, wrong)).toMatchObject({ correct: 0, passed: false });
  });
  it("does not pass an unfinished check", () => {
    const [first, ...rest] = ids;
    expect(gradeKnowledgeCheck(rootCauseSkillShot, { [first.id]: first.correctId }).passed).toBe(false);
    expect(rest.length).toBeGreaterThan(0);
  });
});
