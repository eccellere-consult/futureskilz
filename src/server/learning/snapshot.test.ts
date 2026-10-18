import { describe, expect, it } from "vitest";

import { importableSnapshotSchema } from "../../features/learner/snapshot-schema";
import {
  isCorrectCheckIn,
  labelForScore,
  levelFromScore,
  levelsFromImport,
  projectSnapshot,
  scoreFromLevel,
  type StoredLearnerState,
  verifySkillShotResults,
} from "./snapshot";

const answers = {
  "digital-fluency": 0,
  "critical-thinking": 1,
  creativity: 2,
  "human-skills": 3,
  "adaptive-leadership": 1,
};

const draft = {
  name: "Priya",
  currentRole: "Operations manager",
  responsibilityLevel: "manager",
  focus: "leadership",
  horizon: "6-months",
  priorityFamilies: ["human-intelligence"],
  prioritySkills: ["critical-thinking", "not-a-real-skill", "decision-making"],
  challengeType: "decisions",
  challenge: "Choosing between two suppliers with partial data.",
  goal: "Make faster, better-evidenced decisions",
  weeklyMinutes: 30,
};

describe("the stored 0–5 scale", () => {
  it("projects to and from the 0–100 display score", () => {
    expect(levelFromScore(25)).toBe(1.25);
    expect(levelFromScore(100)).toBe(5);
    expect(scoreFromLevel(1.75)).toBe(35);
    expect(scoreFromLevel(levelFromScore(75))).toBe(75);
    expect(scoreFromLevel(9)).toBe(100);
    expect(labelForScore(35)).toBe("Foundation");
    expect(labelForScore(60)).toBe("Developing");
    expect(labelForScore(85)).toBe("Practising");
  });
});

describe("importable snapshots", () => {
  it("drops skills that are not in the Skill Graph and rejects invented answers", () => {
    const parsed = importableSnapshotSchema.parse({ draft, answers });
    expect(parsed.draft.prioritySkills).toEqual(["critical-thinking", "decision-making"]);
    expect(importableSnapshotSchema.safeParse({ draft, answers: { creativity: 7 } }).success).toBe(false);
    expect(importableSnapshotSchema.safeParse({ draft: { ...draft, focus: "fame" } }).success).toBe(false);
  });

  it("verifies check-ins on the server and ignores unknown or repeated Skill Shots", () => {
    expect(isCorrectCheckIn("assumption-test", 2)).toBe(true);
    expect(isCorrectCheckIn("assumption-test", 0)).toBe(false);

    const verified = verifySkillShotResults([
      { slug: "assumption-test", practice: "Observation, interpretation, test.", checkInAnswer: 2 },
      { slug: "assumption-test", practice: "again", checkInAnswer: 2 },
      { slug: "invented-shot", practice: "x", checkInAnswer: 0 },
      { slug: "three-options", practice: "Safe, bold, cheap.", checkInAnswer: 0 },
    ]);
    expect(verified.map(({ slug, correct }) => [slug, correct])).toEqual([
      ["assumption-test", true],
      ["three-options", false],
    ]);
  });

  it("recomputes levels from answers plus correct check-ins only", () => {
    const parsed = importableSnapshotSchema.parse({
      draft,
      answers,
      skillShotResults: [
        { slug: "assumption-test", practice: "note", checkInAnswer: 2 },
        { slug: "three-options", practice: "note", checkInAnswer: 0 },
      ],
    });
    const levels = levelsFromImport(parsed);
    expect(levels.get("critical-thinking")).toBe(3);
    expect(levels.get("creative-thinking")).toBe(3.75);
    expect(levels.get("ai-literacy")).toBe(1.25);
    expect(levelsFromImport(importableSnapshotSchema.parse({ draft, answers: { creativity: 1 } })).size).toBe(0);
  });
});

describe("projectSnapshot", () => {
  it("rebuilds the browser snapshot the existing pages render", () => {
    const state: StoredLearnerState = {
      displayName: "Priya",
      profile: {
        currentRole: "Operations manager",
        responsibilityLevel: "manager",
        focus: "leadership",
        horizon: "6-months",
        priorityFamilies: ["human-intelligence"],
        challengeType: "decisions",
        challenge: "Choosing suppliers.",
        weeklyMinutes: 30,
        welcomeSummary: "What I heard: …",
        welcomeSummarySource: "template",
      },
      goal: { title: "Make faster decisions", skillSlugs: ["critical-thinking"] },
      answers,
      anchorLevels: new Map([["critical-thinking", 3]]),
      results: [{ slug: "assumption-test", practice: "note", checkInAnswer: 2, completedAt: new Date("2026-10-18T10:00:00Z") }],
      evidence: [{ slug: "assumption-test", createdAt: new Date("2026-10-18T10:00:00Z") }],
    };

    const snapshot = projectSnapshot(state);
    expect(snapshot.draft).toMatchObject({ name: "Priya", goal: "Make faster decisions", prioritySkills: ["critical-thinking"], weeklyMinutes: 30 });
    expect(snapshot.scores?.find(({ id }) => id === "critical-thinking")).toMatchObject({ score: 60, level: "Developing" });
    expect(snapshot.scores?.find(({ id }) => id === "human-skills")).toMatchObject({ score: 100, level: "Leading" });
    expect(snapshot.completedSkillShots).toEqual(["assumption-test"]);
    expect(snapshot.evidence?.[0]).toMatchObject({ pillarId: "critical-thinking", scoreDelta: 10 });
    expect(snapshot.account).toEqual({ displayName: "Priya", welcomeSummary: "What I heard: …", welcomeSummarySource: "template" });
  });

  it("leaves scores out until the baseline is complete", () => {
    const snapshot = projectSnapshot({
      displayName: "New learner",
      profile: null,
      goal: null,
      answers: { creativity: 2 },
      anchorLevels: new Map(),
      results: [],
      evidence: [],
    });
    expect(snapshot.scores).toBeUndefined();
    expect(snapshot.draft.name).toBe("New learner");
  });
});
