import { describe, expect, it } from "vitest";

import { pillars, scoreAssessment } from "../assessment/model";

import { applyEvidence, buildStarterJourney, getSkillShot, skillShots } from "./model";

describe("starter journey", () => {
  it("keeps one reviewed Skill Shot available for every pillar", () => {
    expect(new Set(skillShots.map((skillShot) => skillShot.pillarId))).toEqual(
      new Set(pillars.map((pillar) => pillar.id)),
    );
  });

  it("prioritises Skill Shots for the two lowest pillar scores", () => {
    const scores = scoreAssessment({
      "digital-fluency": 3,
      "critical-thinking": 0,
      creativity: 2,
      "human-skills": 3,
      "adaptive-leadership": 1,
    });

    expect(buildStarterJourney(scores).map((step) => step.skillShot.pillarId)).toEqual([
      "critical-thinking",
      "adaptive-leadership",
    ]);
  });

  it("finds a Skill Shot by its stable route slug", () => {
    expect(getSkillShot("influence-map")?.pillarId).toBe("human-skills");
  });

  it("keeps completed Skill Shots in journey order after scores adapt", () => {
    const scores = scoreAssessment({
      "digital-fluency": 0,
      "critical-thinking": 2,
      creativity: 3,
      "human-skills": 3,
      "adaptive-leadership": 0,
    });
    const adapted = applyEvidence(scores, "digital-fluency", 10);

    expect(buildStarterJourney(adapted, ["ai-decision-brief"]).map((step) => step.skillShot.slug)).toEqual([
      "ai-decision-brief",
      "change-reset",
    ]);
  });

  it("moves the evidenced pillar without exceeding the score ceiling", () => {
    const scores = scoreAssessment({
      "digital-fluency": 3,
      "critical-thinking": 0,
      creativity: 2,
      "human-skills": 3,
      "adaptive-leadership": 1,
    });

    expect(applyEvidence(scores, "critical-thinking", 10).find((score) => score.id === "critical-thinking")).toMatchObject({
      score: 35,
      level: "Foundation",
    });
    expect(applyEvidence(scores, "digital-fluency", 10).find((score) => score.id === "digital-fluency")?.score).toBe(100);
  });
});