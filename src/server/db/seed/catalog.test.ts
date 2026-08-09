import { describe, expect, it } from "vitest";

import { seedRoles, seedSkillRelationships, seedSkills } from "./catalog";

describe("Release 1 seed catalog", () => {
  it("contains the specified 50 priority skills with stable unique slugs", () => {
    expect(seedSkills).toHaveLength(50);
    expect(new Set(seedSkills.map(({ slug }) => slug))).toHaveLength(seedSkills.length);
    expect(seedSkills.map(({ slug }) => slug)).toEqual(expect.arrayContaining([
      "critical-thinking",
      "learning-agility",
      "executive-communication",
      "ai-literacy",
      "ai-assisted-analysis",
      "data-literacy",
    ]));
  });

  it("contains the 12 specified starter roles with valid skill requirements", () => {
    const skillSlugs = new Set(seedSkills.map(({ slug }) => slug));

    expect(seedRoles).toHaveLength(12);
    expect(new Set(seedRoles.map(({ slug }) => slug))).toHaveLength(seedRoles.length);
    for (const role of seedRoles) {
      expect(role.requiredSkills.length).toBeGreaterThanOrEqual(4);
      expect(role.requiredSkills.every(({ skillSlug }) => skillSlugs.has(skillSlug))).toBe(true);
      expect(role.requiredSkills.every(({ targetLevel }) => targetLevel >= 0 && targetLevel <= 5)).toBe(true);
    }
  });

  it("connects only known skills with unique, weighted graph relationships", () => {
    const skillSlugs = new Set(seedSkills.map(({ slug }) => slug));
    const relationshipKeys = seedSkillRelationships.map((relationship) =>
      `${relationship.sourceSkillSlug}:${relationship.targetSkillSlug}:${relationship.relationshipType}`,
    );

    expect(seedSkillRelationships.length).toBeGreaterThanOrEqual(20);
    expect(new Set(relationshipKeys)).toHaveLength(relationshipKeys.length);
    for (const relationship of seedSkillRelationships) {
      expect(skillSlugs.has(relationship.sourceSkillSlug)).toBe(true);
      expect(skillSlugs.has(relationship.targetSkillSlug)).toBe(true);
      expect(relationship.sourceSkillSlug).not.toBe(relationship.targetSkillSlug);
      expect(relationship.weight).toBeGreaterThan(0);
      expect(relationship.weight).toBeLessThanOrEqual(1);
    }
  });
});