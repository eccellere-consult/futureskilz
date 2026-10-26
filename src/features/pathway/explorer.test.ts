import { describe, expect, it } from "vitest";

import { scoreAssessment } from "../assessment/model";
import { estimateSkills, type DiagnosticLevel } from "./estimate";
import { BAND_LABEL, rankRoles, readinessFor, roleSimilarity, suggestRoleForTitle, viewRole } from "./explorer";
import { TARGET_ROLES, getRole } from "./roles";

const strong = scoreAssessment({ "digital-fluency": 3, "critical-thinking": 3, creativity: 3, "human-skills": 3, "adaptive-leadership": 3 });
const weak = scoreAssessment({ "digital-fluency": 0, "critical-thinking": 0, creativity: 0, "human-skills": 0, "adaptive-leadership": 0 });

describe("readiness", () => {
  it("is higher for a stronger learner and never claims more than it can see", () => {
    const role = getRole("project-manager")!;
    const high = readinessFor(role, estimateSkills(strong));
    const low = readinessFor(role, estimateSkills(weak));
    expect(high.score).toBeGreaterThan(low.score);
    expect(high.score).toBeLessThanOrEqual(1);
    // Self-rating alone is not evidence of anything beyond itself.
    expect(high.evidencedShare).toBe(0);
  });

  it("says there is too little evidence when most of what the role needs was never assessed", () => {
    const r = readinessFor(getRole("finance-analyst")!, estimateSkills(undefined));
    expect(r.checkedShare).toBe(0);
    expect(r.score).toBe(0);
    expect(r.band).toBe("too-little-evidence");
    expect(BAND_LABEL[r.band]).toBe("Too little evidence to say");
  });

  it("does not say 'ready to try' on a self-rating alone, however high", () => {
    const role = getRole("business-analyst")!;
    const r = readinessFor(role, estimateSkills(scoreAssessment({ "digital-fluency": 3, "critical-thinking": 3, creativity: 3, "human-skills": 3, "adaptive-leadership": 3 })));
    expect(r.score).toBeGreaterThanOrEqual(0.8);
    expect(r.evidencedShare).toBe(0);
    expect(r.band).toBe("close");
  });

  it("counts described situations as evidence for the share they cover", () => {
    const role = getRole("ai-product-manager")!;
    const diag: DiagnosticLevel[] = role.requirements.map((need) => ({ skill: need.skill, level: need.level, confidence: 0.5, kind: "reported-behaviour" }));
    const r = readinessFor(role, estimateSkills(strong, [], [], diag));
    expect(r).toMatchObject({ score: 1, band: "ready-to-try", checkedShare: 1, evidencedShare: 1 });
  });
});

describe("roles side by side", () => {
  it("is symmetric, 1 for itself, and higher for related roles than for unrelated ones", () => {
    const a = getRole("production-planner")!;
    const b = getRole("operations-manager")!;
    const c = getRole("marketing-manager")!;
    expect(roleSimilarity(a, a)).toBe(1);
    expect(roleSimilarity(a, b)).toBe(roleSimilarity(b, a));
    expect(roleSimilarity(a, b)).toBeGreaterThan(roleSimilarity(a, c));
  });

  it("splits what carries over from what is missing, with nothing in both", () => {
    const role = getRole("ai-product-manager")!;
    const view = viewRole(role, estimateSkills(strong, [], [], [{ skill: "ai-literacy", level: 4, confidence: 0.5, kind: "reported-behaviour" }]));
    expect(view.carriesOver.some((s) => s.skill === "ai-literacy")).toBe(true);
    expect(view.missing.some((s) => s.skill === "ai-literacy")).toBe(false);
    expect(view.carriesOver.length + view.missing.length).toBe(role.requirements.length);
    expect(view.missing.some((s) => s.current === null)).toBe(true);
  });

  it("ranks every seeded role, nearest first, with closeness when there is a starting role", () => {
    const from = getRole("production-planner")!;
    const ranked = rankRoles(estimateSkills(strong), from);
    expect(ranked).toHaveLength(TARGET_ROLES.length);
    // Nearest first, except that roles within two points of each other are ordered by how close they are to the starting role.
    ranked.slice(1).forEach((r, i) => expect(r.readiness.score).toBeLessThanOrEqual(ranked[i].readiness.score + 0.02));
    expect(ranked.find((r) => r.role.id === from.id)!.closeness).toBe(1);
    expect(rankRoles(estimateSkills(strong))[0].closeness).toBeNull();
  });
});

describe("a job title is a hypothesis", () => {
  it("suggests a seeded role only when the title really matches", () => {
    expect(suggestRoleForTitle("Senior Production Planner")?.id).toBe("production-planner");
    expect(suggestRoleForTitle("Operations Manager, Pune plant")?.id).toBe("operations-manager");
    expect(suggestRoleForTitle("Chief Happiness Officer")).toBeNull();
    expect(suggestRoleForTitle("")).toBeNull();
    expect(suggestRoleForTitle("manager")).toBeNull();
  });
});
