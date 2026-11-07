import { describe, expect, it } from "vitest";

import { briefSchema } from "../../server/agents/instructional-design";
import { designedSkillShots } from ".";
import { slugOf } from "./scaffold";
import { WAVE_ONE } from "./wave1";

describe("content wave 1", () => {
  it("is twelve valid, distinct briefs that do not repeat a Skill Shot that already exists", () => {
    expect(WAVE_ONE).toHaveLength(12);
    for (const brief of WAVE_ONE) expect(briefSchema.safeParse(brief).success, brief.topic).toBe(true);
    const slugs = WAVE_ONE.map((brief) => slugOf(brief.topic));
    expect(new Set(slugs).size).toBe(12);
    for (const existing of designedSkillShots) expect(slugs).not.toContain(existing.meta.id);
  });
  it("states no real organisation, person or figure in its notes", () => {
    for (const brief of WAVE_ONE) expect(brief.sourceNotes, brief.topic).not.toMatch(/\d+\s?%|\$\s?\d|₹\s?\d|\b(Google|Toyota|Amazon|McKinsey)\b/);
  });
});
