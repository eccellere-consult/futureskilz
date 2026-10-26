import { describe, expect, it } from "vitest";

import { parseBlueprint } from "./schema";
import { rootCauseSkillShot } from "./samples/root-cause";

describe("parseBlueprint", () => {
  it("accepts the sample, as an object or in a code fence", () => {
    expect(parseBlueprint(rootCauseSkillShot).ok).toBe(true);
    expect(parseBlueprint("```json\n" + JSON.stringify(rootCauseSkillShot) + "\n```").ok).toBe(true);
  });
  it("rejects invalid JSON, unknown skills and a correct answer that is not an option", () => {
    expect(parseBlueprint("not json").ok).toBe(false);
    const badSkill = structuredClone(rootCauseSkillShot);
    badSkill.meta.skillMap = [{ skill: "made-up", toLevel: 2 }];
    expect(parseBlueprint(badSkill).ok).toBe(false);
    const badAnswer = structuredClone(rootCauseSkillShot);
    badAnswer.knowledgeCheck[0].correctId = "zzz";
    const result = parseBlueprint(badAnswer);
    expect(result.ok).toBe(false);
  });
});
