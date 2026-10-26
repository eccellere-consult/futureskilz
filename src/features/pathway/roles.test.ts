import { describe, expect, it } from "vitest";

import { skillTaxonomy } from "../../domain/skills/taxonomy";
import { TARGET_ROLES, getRole } from "./roles";

const known = new Set(skillTaxonomy.map((skill) => skill.slug));

describe("target roles", () => {
  it("offers 12 to 15 roles with unique ids", () => {
    expect(TARGET_ROLES.length).toBeGreaterThanOrEqual(12);
    expect(TARGET_ROLES.length).toBeLessThanOrEqual(15);
    expect(new Set(TARGET_ROLES.map((role) => role.id)).size).toBe(TARGET_ROLES.length);
  });

  it("asks only for capabilities that exist in the Skill Graph, at levels on the stored scale", () => {
    for (const role of TARGET_ROLES) {
      expect(role.requirements.length, role.id).toBeGreaterThanOrEqual(6);
      expect(new Set(role.requirements.map((item) => item.skill)).size, `${role.id} lists a skill twice`).toBe(role.requirements.length);
      for (const item of role.requirements) {
        expect(known.has(item.skill), `${role.id}: ${item.skill}`).toBe(true);
        expect(item.level).toBeGreaterThanOrEqual(1);
        expect(item.level).toBeLessThanOrEqual(5);
      }
      expect(role.requirements.some((item) => item.criticality === 3), `${role.id} has no core capability`).toBe(true);
    }
  });

  it("finds a role by id", () => {
    expect(getRole("ai-product-manager")?.title).toBe("AI Product Manager");
    expect(getRole("nope")).toBeUndefined();
    expect(getRole(null)).toBeUndefined();
  });
});
