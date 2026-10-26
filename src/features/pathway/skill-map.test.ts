import { describe, expect, it } from "vitest";

import { skillTaxonomy } from "../../domain/skills/taxonomy";
import { RULES, cleanSkillMap, confirmedSkills, levelForProficiency, suggestSkills } from "./skill-map";

const lesson = {
  title: "Re-plan the shift when a machine goes down",
  objective: "Re-plan a production schedule when something unexpected happens and tell the team what changed.",
  narration: ["When a line stops, list the orders affected, decide what moves, and communicate the new schedule to every shift lead.", "Check capacity before you promise a date."],
  proficiency: "working",
};

describe("suggestSkills", () => {
  it("suggests skills the words point at, strongest first, with the reasons", () => {
    const out = suggestSkills(lesson);
    const slugs = out.map((s) => s.skill);
    expect(slugs).toContain("operations");
    expect(slugs).toContain("adaptability");
    expect(out.every((s) => s.hits.length > 0 && s.toLevel === 2.5)).toBe(true);
    expect(out.length).toBeLessThanOrEqual(5);
  });
  it("suggests nothing for an empty lesson and never invents unknown skills", () => {
    expect(suggestSkills({})).toEqual([]);
  });
});

describe("cleanSkillMap and confirmedSkills", () => {
  it("keeps known skills once, clamps and rounds levels", () => {
    expect(cleanSkillMap([{ skill: "operations", toLevel: 9 }, { skill: "operations", toLevel: 2 }, { skill: "nope", toLevel: 2 }, { skill: "finance", toLevel: 2.3 }, "x"])).toEqual([
      { skill: "operations", toLevel: 5 },
      { skill: "finance", toLevel: 2.5 },
    ]);
    expect(cleanSkillMap("bad")).toEqual([]);
  });
  it("only a confirmed map counts", () => {
    expect(confirmedSkills({ skillMap: { status: "suggested", skills: [{ skill: "operations", toLevel: 2 }] } })).toEqual([]);
    expect(confirmedSkills({ skillMap: { status: "confirmed", skills: [{ skill: "operations", toLevel: 2 }] } })).toHaveLength(1);
  });
  it("maps coach proficiency to a level", () => {
    expect(levelForProficiency("expert")).toBe(4.5);
    expect(levelForProficiency(undefined)).toBe(2);
  });
});

describe("rules", () => {
  it("only name skills that exist in the Skill Graph, and cover every skill", () => {
    const slugs = new Set(skillTaxonomy.map((s) => s.slug));
    for (const skill of Object.keys(RULES)) expect(slugs.has(skill), skill).toBe(true);
    const missing = [...slugs].filter((slug) => !(slug in RULES));
    expect(missing).toEqual([]);
  });
});
