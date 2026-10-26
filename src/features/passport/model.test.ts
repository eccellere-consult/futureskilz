import { describe, expect, it } from "vitest";

import { DEFAULT_SHARE, applyPrivacy, confidenceLabel, summariseBasis, toCsv, type Passport } from "./model";

const passport: Passport = {
  name: "Priya Nair",
  currentRole: "Production Planner",
  targetRole: "Operations Manager",
  generatedAt: "2026-10-26T10:00:00.000Z",
  skills: [
    { skill: "problem-solving", name: "Problem solving", family: "Thinking & problem solving", level: 3, confidence: 0.55, source: "evidence", withResult: false },
    { skill: "influence", name: "Influence", family: "Working with people", level: 2.5, confidence: 0.3, source: "baseline", withResult: false },
    { skill: "ai-literacy", name: "AI literacy", family: "Working with AI", level: 2, confidence: 0.4, source: "diagnostic", withResult: true },
  ],
  evidence: [{ title: "Find the cause, not just the symptom", kind: "skill-shot", date: "2026-10-20", skills: ["problem-solving"] }],
  basis: { selfRatingOnly: 1, described: 1, completedLessons: 1, inferredNotListed: 0 },
};

describe("what a link may show", () => {
  it("by default shows no name and no current role, but keeps skills", () => {
    const shown = applyPrivacy(passport, DEFAULT_SHARE);
    expect(shown.name).toBe("A FutureSkilz learner");
    expect(shown.currentRole).toBe("");
    expect(shown.skills).toEqual(passport.skills);
    expect(JSON.stringify(shown)).not.toContain("Priya");
  });
  it("follows the owner's choices and never adds anything", () => {
    const all = applyPrivacy(passport, { name: true, targetRole: true, evidence: true });
    expect(all).toEqual(passport);
    const none = applyPrivacy(passport, { name: false, targetRole: false, evidence: false });
    expect(none.targetRole).toBeNull();
    expect(none.evidence).toEqual([]);
  });
  it("has no place for goals, challenges, practice notes or conversations", () => {
    expect(Object.keys(passport).sort()).toEqual(["basis", "currentRole", "evidence", "generatedAt", "name", "skills", "targetRole"]);
  });
});

describe("confidence and basis", () => {
  it("labels confidence plainly, and never reaches 'verified'", () => {
    expect([0.2, 0.4, 0.6].map(confidenceLabel)).toEqual(["Low", "Medium", "Higher"]);
  });
  it("counts what backs the skills", () => {
    expect(summariseBasis(passport.skills, 4)).toEqual({ selfRatingOnly: 1, described: 1, completedLessons: 1, inferredNotListed: 4 });
  });
});

describe("export", () => {
  it("makes a spreadsheet-safe CSV with the source of each level", () => {
    const csv = toCsv(passport);
    expect(csv.split("\n")[0]).toBe("Skill,Family,Level (0-5),Confidence,Confidence (0-1),Backed by");
    expect(csv).toContain("Problem solving,Thinking & problem solving,3.0,Higher,0.55,A lesson you completed with a correct check");
    expect(csv).toContain("with a result you described");
  });
  it("neutralises cells that a spreadsheet would run as formulas, and quotes commas", () => {
    const csv = toCsv({ ...passport, skills: [{ ...passport.skills[0], name: "=HYPERLINK(\"x\")", family: "A, B" }] });
    expect(csv).toContain("\"'=HYPERLINK(\"\"x\"\")\"");
    expect(csv).toContain('"A, B"');
  });
});
