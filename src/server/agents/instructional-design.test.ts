import { describe, expect, it } from "vitest";

import { reviewBlueprint } from "../../features/skillshot/rubric";
import { rootCauseSkillShot } from "../../features/skillshot/samples/root-cause";
import { DeterministicAiProvider, type AiProvider } from "../providers/ai";
import { briefSchema, createInstructionalDesignAgent } from "./instructional-design";

const brief = briefSchema.parse({
  topic: "Find the cause, not just the symptom",
  skills: [{ skill: "problem-solving", toLevel: 2.5 }],
  audience: "New joiners who fix problems that keep coming back",
  proficiency: "foundational",
  sourceNotes: "",
  contributor: "A. Coach",
  sourceKind: "illustrative",
});

const reply = (...contents: string[]): AiProvider => {
  let i = 0;
  return { name: "openai", model: "t", async generate() { return { content: contents[Math.min(i++, contents.length - 1)], provider: "openai", model: "t", usage: { inputTokens: 1, outputTokens: 1, costMicros: 0 } }; } };
};
const run = (ai: AiProvider) => createInstructionalDesignAgent(ai).execute(brief, {});

describe("the sample passes the automatic checks, so it is a fair target", () => {
  it("has no blockers", () => expect(reviewBlueprint(rootCauseSkillShot).blockers).toEqual([]));
});

describe("instructional design agent", () => {
  it("without AI returns the structure with placeholders, which the checks refuse to pass", async () => {
    const out = await run(new DeterministicAiProvider());
    expect(out.source).toBe("scaffold");
    expect(out.review.passes).toBe(false);
    expect(out.review.blockers.join(" ")).toMatch(/unfinished/);
    expect(out.blueprint.meta.reviewStatus).toBe("draft");
    expect(out.blueprint.meta.skillMap).toEqual(brief.skills);
  });

  it("accepts a good draft first time and pins identity, status and skills to the brief", async () => {
    const wild = structuredClone(rootCauseSkillShot);
    wild.meta.reviewStatus = "published";
    wild.meta.id = "something-else";
    wild.meta.skillMap = [{ skill: "finance", toLevel: 5 }];
    const out = await run(reply(JSON.stringify(wild)));
    expect(out).toMatchObject({ source: "ai", attempts: 1 });
    expect(out.blueprint.meta).toMatchObject({ reviewStatus: "draft", id: "find-the-cause-not-just-the-symptom", contributorAttribution: "A. Coach" });
    expect(out.blueprint.meta.skillMap).toEqual(brief.skills);
  });

  it("asks once for a repair when the first draft falls short", async () => {
    const weak = structuredClone(rootCauseSkillShot);
    weak.disclosure = "A lesson.";
    const out = await run(reply(JSON.stringify(weak), JSON.stringify(rootCauseSkillShot)));
    expect(out).toMatchObject({ source: "ai", attempts: 2 });
    expect(out.review.passes).toBe(true);
  });

  it("keeps the closest draft, and says so, when the repair does not fully work", async () => {
    const weak = structuredClone(rootCauseSkillShot);
    weak.disclosure = "A lesson.";
    const out = await run(reply(JSON.stringify(weak)));
    expect(out.source).toBe("ai");
    expect(out.review.passes).toBe(false);
    expect(out.notes.join(" ")).toMatch(/person needs to fix/);
  });

  it("falls back to the scaffold when the model returns nonsense or fails", async () => {
    expect((await run(reply("sorry, cannot"))).source).toBe("scaffold");
    const failing: AiProvider = { name: "openai", model: "t", async generate() { throw new Error("down"); } };
    expect((await run(failing)).source).toBe("scaffold");
  });

  it("rejects a brief with an unknown skill", () => {
    expect(briefSchema.safeParse({ ...brief, skills: [{ skill: "nope", toLevel: 2 }] }).success).toBe(false);
  });
});
