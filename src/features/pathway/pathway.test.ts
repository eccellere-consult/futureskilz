import { describe, expect, it } from "vitest";
import { scoreAssessment } from "../assessment/model";
import { builtInAssets, validAssetSkills } from "./assets";
import { estimateSkills, estimateFor } from "./estimate";
import { computeGaps, weeklyBudgetMinutes } from "./gaps";
import { planPathway } from "./journey";
import { getRole } from "./roles";

const scores = scoreAssessment({ "digital-fluency": 1, "critical-thinking": 1, creativity: 1, "human-skills": 1, "adaptive-leadership": 1 });

describe("estimates", () => {
  it("reads the baseline into related skills at lower confidence and leaves others unknown", () => {
    const e = estimateSkills(scores);
    expect(estimateFor(e, "critical-thinking")).toMatchObject({ level: 2.5, source: "baseline" });
    expect(estimateFor(e, "problem-solving").source).toBe("inferred");
    expect(estimateFor(e, "finance")).toMatchObject({ level: null, source: "none" });
  });
  it("moves a level on correct evidence only", () => {
    const e = estimateSkills(scores, [{ skill: "critical-thinking", correct: true }, { skill: "influence", correct: false }]);
    expect(estimateFor(e, "critical-thinking").level).toBe(3);
    expect(estimateFor(e, "influence").source).toBe("baseline");
  });
});

describe("evidence on the account", () => {
  it("raises confidence and never lowers a level the learner's own descriptions already support", () => {
    const diag = [{ skill: "problem-solving", level: 3.5, confidence: 0.4, kind: "reported-behaviour" as const }];
    // A level earned only from lessons starts at zero, so one pass leaves 0.5 on the account.
    const e = estimateSkills(scores, [], [{ skill: "problem-solving", level: 0.5, confidence: 0.4, evidenceCount: 1 }], diag);
    expect(estimateFor(e, "problem-solving")).toMatchObject({ level: 3.5, source: "evidence", confidence: 0.4 });
    // Where the account holds more, it wins.
    const higher = estimateSkills(scores, [], [{ skill: "problem-solving", level: 4, confidence: 0.5, evidenceCount: 2 }], diag);
    expect(estimateFor(higher, "problem-solving")).toMatchObject({ level: 4, confidence: 0.5 });
  });
});

describe("gaps and pathway", () => {
  const role = getRole("ai-product-manager")!;
  const gaps = computeGaps(role, estimateSkills(scores), "90-days");
  it("flags unknown skills to check first and ranks measured gaps by priority", () => {
    expect(gaps.some((g) => g.status === "check-first")).toBe(true);
    const ranked = gaps.map((g) => g.priority);
    expect([...ranked].sort((a, b) => b - a)).toEqual(ranked);
    expect(gaps.filter((g) => g.status === "met").every((g) => g.priority === 0)).toBe(true);
  });
  it("is more urgent for a shorter horizon", () => {
    const slow = computeGaps(role, estimateSkills(scores), "12-months");
    expect(gaps.find((g) => g.status === "gap")!.priority).toBeGreaterThan(slow.find((g) => g.skill === gaps.find((x) => x.status === "gap")!.skill)!.priority);
  });
  it("builds steps from assets, within budget, and lists content gaps", () => {
    const p = planPathway(gaps, builtInAssets(), { budgetMinutes: weeklyBudgetMinutes(60, "90-days") });
    expect(p.steps.length).toBeGreaterThan(0);
    expect(new Set(p.steps.map((s) => s.asset.id)).size).toBe(p.steps.length);
    expect(p.contentGaps.length).toBeGreaterThan(0);
    for (const s of p.steps) expect(s.evidenceSignal).toBeTruthy();
  });
  it("defers steps that do not fit the time available", () => {
    const p = planPathway(gaps, builtInAssets(), { budgetMinutes: 1 });
    expect(p.steps.length).toBe(1);
    expect(p.deferred.length).toBeGreaterThan(0);
  });
  it("prefers a coach lesson over a legacy Skill Shot for the same skill", () => {
    const target = gaps.find((g) => g.status === "gap")!.skill;
    const lesson = { id: "coach-lesson:1", kind: "coach-lesson" as const, title: "L", summary: "", href: "/x", minutes: 10, skills: [{ skill: target, toLevel: 5 }], practice: "p" };
    const p = planPathway(gaps, [lesson, ...builtInAssets()], { budgetMinutes: 600 });
    expect(p.steps.find((s) => s.skill === target)?.asset.kind).toBe("coach-lesson");
  });
});

describe("assets", () => {
  it("only uses skills that exist in the graph", () => {
    for (const a of builtInAssets()) expect(validAssetSkills(a.skills).length, a.id).toBe(a.skills.length);
  });
});
