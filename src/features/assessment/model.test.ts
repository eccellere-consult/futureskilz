import { describe, expect, it } from "vitest";

import { findPriorityPillars, pillars, scoreAssessment } from "./model";

describe("assessment model", () => {
  it("maps response choices to bounded pillar scores", () => {
    const answers = Object.fromEntries(pillars.map((pillar, index) => [pillar.id, index % 4]));

    expect(scoreAssessment(answers)).toMatchObject([
      { score: 25, level: "Foundation" },
      { score: 50, level: "Developing" },
      { score: 75, level: "Practising" },
      { score: 100, level: "Leading" },
      { score: 25, level: "Foundation" },
    ]);
  });

  it("rejects incomplete assessments", () => {
    expect(() => scoreAssessment({})).toThrow("Missing or invalid answer");
  });

  it("returns the lowest scoring pillars first", () => {
    const answers = Object.fromEntries(pillars.map((pillar, index) => [pillar.id, 3 - (index % 4)]));
    const scores = scoreAssessment(answers);

    expect(findPriorityPillars(scores).map((pillar) => pillar.score)).toEqual([25, 50]);
  });
});