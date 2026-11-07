import { describe, expect, it } from "vitest";

import { scoreAssessment } from "../assessment/model";
import { estimateSkills } from "../pathway/estimate";
import { computeGaps } from "../pathway/gaps";
import { getRole } from "../pathway/roles";
import { familiesOf, levelOf, rolesFor, type Listing } from "./listing";
import { qualityScore } from "./quality";
import { recommendForGaps } from "./recommend";
import { facetsOf, relevance, searchListings } from "./search";

const make = (over: Partial<Listing> & { id: string }): Listing => ({
  kind: "coach-lesson", title: "Untitled", summary: "", href: `/lessons/${over.id}`, minutes: 5, level: "working", skills: [], families: [], roles: [], industry: "", roleLabel: "", creator: { name: "Someone", profileId: null }, learners: null, quality: qualityScore({}), updatedAt: "2026-10-01", ...over,
});
const skills = (...items: Array<[string, number]>) => items.map(([skill, toLevel]) => ({ skill, toLevel }));

const a = make({ id: "a", title: "Negotiate a supplier contract", summary: "Win better terms without losing the relationship", skills: skills(["negotiation", 3]), minutes: 8, industry: "Manufacturing", creator: { name: "Asha Rao", profileId: "p1" } });
const b = make({ id: "b", title: "Plan a small project on one page", summary: "Goal, owners, dates and risks", kind: "designed-skill-shot", skills: skills(["project-management", 2.5]), minutes: 7, level: "foundational", quality: qualityScore({ contentQuality: 0.9 }) });
const c = make({ id: "c", title: "Production scheduling basics", summary: "Sequence orders across lines", skills: skills(["operations", 3]), minutes: 12, industry: "Manufacturing", quality: qualityScore({ usefulness: { n: 20, usefulShare: 0.9 }, contentQuality: 0.8, learners: 20 }), updatedAt: "2026-09-01" });
const all = [a, b, c].map((l) => ({ ...l, families: familiesOf(l.skills), roles: rolesFor(l.skills) }));

describe("search", () => {
  it("finds by title, skill name, summary and creator, matching the start of a word", () => {
    expect(searchListings(all, { query: "negotiat" }).map((l) => l.id)).toEqual(["a"]);
    expect(searchListings(all, { query: "project risks" }).map((l) => l.id)).toEqual(["b"]);
    expect(searchListings(all, { query: "asha" }).map((l) => l.id)).toEqual(["a"]);
    expect(searchListings(all, { query: "zebra" })).toEqual([]);
  });
  it("ranks a listing that matches every word above one that matches some", () => {
    expect(relevance(all[2], "production scheduling")).toBeGreaterThan(relevance(all[2], "production banana"));
  });
  it("filters by family, role, industry, level, kind and time, together", () => {
    expect(searchListings(all, { industry: "manufacturing" }).map((l) => l.id).sort()).toEqual(["a", "c"]);
    expect(searchListings(all, { level: "foundational" }).map((l) => l.id)).toEqual(["b"]);
    expect(searchListings(all, { kind: "designed-skill-shot" }).map((l) => l.id)).toEqual(["b"]);
    expect(searchListings(all, { maxMinutes: 8 }).map((l) => l.id).sort()).toEqual(["a", "b"]);
    expect(searchListings(all, { family: all[2].families[0], industry: "Manufacturing" }).map((l) => l.id)).toContain("c");
  });
  it("sorts by usefulness only among rated listings, newest, and shortest", () => {
    expect(searchListings(all, {}, "useful")[0].id).toBe("c");
    expect(searchListings(all, {}, "new")[0].id).toBe("a");
    expect(searchListings(all, {}, "short").map((l) => l.minutes)).toEqual([7, 8, 12]);
    expect(searchListings(all, {}, "quality")[0].id).toBe("c");
  });
  it("counts the facets over what matches the search", () => {
    const f = facetsOf(all);
    expect(f.industries).toEqual([{ name: "Manufacturing", count: 2 }]);
    expect(f.kinds.map((k) => k.id).sort()).toEqual(["coach-lesson", "designed-skill-shot"]);
    expect(facetsOf(all, "negotiat").kinds).toEqual([{ id: "coach-lesson", count: 1 }]);
  });
});

describe("listing helpers", () => {
  it("maps a coach's proficiency to a level and finds roles that ask for the skills", () => {
    expect(["foundational", "working", "proficient", "expert", undefined].map(levelOf)).toEqual(["foundational", "working", "advanced", "advanced", "working"]);
    expect(rolesFor(skills(["project-management", 3]))).toContain("project-manager");
    expect(rolesFor([])).toEqual([]);
  });
});

describe("recommendations from gaps", () => {
  const role = getRole("project-manager")!;
  const gaps = computeGaps(role, estimateSkills(scoreAssessment({ "digital-fluency": 1, "critical-thinking": 1, creativity: 1, "human-skills": 1, "adaptive-leadership": 1 })), "90-days");
  it("recommends what lifts the biggest gaps, with the reason, and nothing that does not", () => {
    const wants = gaps.find((g) => g.status === "gap")!.skill;
    const fit = make({ id: "fit", title: "Fits", skills: skills([wants, 4]), minutes: 6 });
    const none = make({ id: "none", title: "Unrelated", skills: skills(["finance", 4]) });
    const out = recommendForGaps([fit, none], gaps);
    expect(out.map((r) => r.listing.id)).toEqual(["fit"]);
    expect(out[0].reasons[0]).toMatch(/^Builds /);
  });
  it("prefers the quicker of two that do the same, and does not punish an unrated one", () => {
    const wants = gaps.find((g) => g.status === "gap")!.skill;
    const slow = make({ id: "slow", skills: skills([wants, 3.5]), minutes: 40 });
    const fast = make({ id: "fast", skills: skills([wants, 3.5]), minutes: 5 });
    expect(recommendForGaps([slow, fast], gaps)[0].listing.id).toBe("fast");
  });
});
