import { describe, expect, it } from "vitest";

import { briefSchema } from "../../server/agents/instructional-design";
import type { LessonSpec } from "../capture/lessons";
import { skillShots } from "../journey/model";
import { lessonBrief } from "./from-lesson";
import { LEGACY_BRIEFS } from "./legacy";

describe("the older Skill Shots as briefs", () => {
  it("are five valid briefs that keep the old address and cover each old lesson's content", () => {
    expect(LEGACY_BRIEFS).toHaveLength(skillShots.length);
    LEGACY_BRIEFS.forEach((brief, index) => {
      expect(briefSchema.safeParse(brief).success, brief.topic).toBe(true);
      expect(brief.slug).toBe(skillShots[index].slug);
      expect(brief.skills.length).toBeGreaterThan(0);
      expect(brief.sourceNotes).toContain(skillShots[index].concept);
      expect(brief.sourceNotes).toContain(skillShots[index].practicePrompt);
    });
  });
});

describe("a coach lesson as a brief", () => {
  const spec = {
    title: "How to: release a production order", slug: "how-to-release-a-production-order-ab12cd", audience: "New joiners and early-career Production planner", roleLabel: "Production planner", industry: "Manufacturing", proficiency: "working", stage: "process",
    objective: "Apply the sequence for releasing a production order to a task in your own work.", prerequisites: ["Know the role's main responsibilities"], coreConcept: "Check demand, schedule the lines, then release orders.",
    narration: ["Welcome.", "Check demand, schedule the lines, then release orders."], scenes: [], example: "We cut changeover time by 20 percent.", caution: "Never release before checking capacity.",
    check: { prompt: "Explain this to a colleague.", guidance: "Use a concrete example.", demonstration: null }, summary: "Three steps.", nextStep: "practise", durationSeconds: 120, factIds: [], refs: [], attribution: "Asha Rao", generatedAt: "2026-10-26T00:00:00Z",
  } as unknown as LessonSpec;
  it("carries the coach's own words, credit and lesson id, and passes the brief checks", () => {
    const brief = lessonBrief(spec, "lesson-1");
    expect(briefSchema.safeParse(brief).success).toBe(true);
    expect(brief).toMatchObject({ sourceKind: "expert-interview", contributor: "Asha Rao", sourceLessonId: "lesson-1", proficiency: "working", slug: "lesson-how-to-release-a-production-order-ab12cd" });
    expect(brief.sourceNotes).toContain("We cut changeover time by 20 percent.");
    expect(brief.sourceNotes).toContain("Never release before checking capacity.");
    expect(brief.skills.length).toBeGreaterThan(0);
  });
});
