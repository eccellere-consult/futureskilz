import { describe, expect, it } from "vitest";

import { rootCauseSkillShot } from "./samples/root-cause";
import { parseBlueprint } from "./schema";

/** A good lesson with the small slips real models make. Before the tidy step each of these discarded the whole reply. */
function slipped(): Record<string, unknown> {
  const draft = JSON.parse(JSON.stringify(rootCauseSkillShot)) as Record<string, Record<string, unknown>> & { scenes: Array<Record<string, unknown>>; knowledgeCheck: Array<Record<string, unknown>> };
  draft.meta.industry = null;
  draft.meta.teachingPattern = "b";
  draft.design.limitationsAndCaveats = "It finds one cause at a time. It depends on honest answers.";
  draft.learningPath.position = 3;
  draft.scenes[0].pauseSeconds = "2";
  draft.scenes[0].cue = "wave";
  draft.scenes[1].visual = { type: "hologram", items: [] };
  draft.meta.prerequisites = null;
  return draft;
}

describe("an AI reply with small slips", () => {
  it("is accepted after tidying, with the teaching kept word for word", () => {
    const parsed = parseBlueprint(JSON.stringify(slipped()));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.blueprint.scenes.map((scene) => scene.narration)).toEqual(rootCauseSkillShot.scenes.map((scene) => scene.narration));
    expect(parsed.blueprint.design.limitationsAndCaveats.length).toBeGreaterThan(0);
    expect(parsed.blueprint.meta.industry).toBeUndefined();
    expect(parsed.blueprint.meta.teachingPattern).toBe("B");
    expect(parsed.blueprint.learningPath.position).toBe("3");
    expect(parsed.blueprint.scenes[0].cue).toBe("none");
  });
  it("accepts a reply wrapped in a code fence", () => {
    expect(parseBlueprint("```json\n" + JSON.stringify(slipped()) + "\n```").ok).toBe(true);
  });
  it("still rejects a reply that is not a lesson at all", () => {
    expect(parseBlueprint("I understand. Let us choose one concrete next step.").ok).toBe(false);
    expect(parseBlueprint(JSON.stringify({ hello: "world" })).ok).toBe(false);
  });
});

describe("tidying a correct blueprint", () => {
  it("changes nothing in it", () => {
    const parsed = parseBlueprint(JSON.stringify(rootCauseSkillShot));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.blueprint).toEqual(JSON.parse(JSON.stringify(rootCauseSkillShot)));
  });
});
