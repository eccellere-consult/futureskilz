import { describe, expect, it } from "vitest";

import { skillFamilies, skillsForFamilies, skillTaxonomy } from "./taxonomy";

describe("skill taxonomy", () => {
  it("partitions all 50 skills into six non-overlapping capability families", () => {
    const slugs = skillTaxonomy.map(({ slug }) => slug);

    expect(skillFamilies).toHaveLength(6);
    expect(skillTaxonomy).toHaveLength(50);
    expect(new Set(slugs)).toHaveLength(50);
    expect(skillFamilies.every((family) => family.skills.length > 0)).toBe(true);
  });

  it("returns only skills from the selected discovery branches", () => {
    const selected = skillsForFamilies(["ai-intelligence", "digital-intelligence"]);

    expect(selected).toHaveLength(15);
    expect(new Set(selected.map(({ familyId }) => familyId))).toEqual(
      new Set(["ai-intelligence", "digital-intelligence"]),
    );
  });
});