import { describe, expect, it } from "vitest";

import { availableDiscoverySkills, skillFamilies, toggleSelection } from "./discovery-model";

describe("learner discovery model", () => {
  it("offers all six MECE capability families and all 50 skills", () => {
    const familyIds = skillFamilies.map(({ id }) => id);

    expect(familyIds).toHaveLength(6);
    expect(availableDiscoverySkills(familyIds)).toHaveLength(50);
  });

  it("drills down only into selected capability families", () => {
    const skills = availableDiscoverySkills(["human-to-human-intelligence"]);

    expect(skills).toHaveLength(11);
    expect(new Set(skills.map(({ familyId }) => familyId))).toEqual(
      new Set(["human-to-human-intelligence"]),
    );
  });

  it("toggles multi-select values without exceeding the question limit", () => {
    expect(toggleSelection(["a", "b"], "c", 2)).toEqual(["a", "b"]);
    expect(toggleSelection(["a", "b"], "a", 2)).toEqual(["b"]);
    expect(toggleSelection(["a"], "b", 2)).toEqual(["a", "b"]);
  });
});