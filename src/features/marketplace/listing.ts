import { skillTaxonomy } from "../../domain/skills/taxonomy";
import type { AssetKind, AssetSkill } from "../pathway/assets";
import { TARGET_ROLES } from "../pathway/roles";
import type { QualityResult } from "./quality";

/**
 * One thing a learner can learn from, whoever made it and however it is delivered. The marketplace shows listings; a learner's
 * own pathway stays the primary route, and the marketplace is how they find more.
 */
export type Level = "foundational" | "working" | "advanced";
export type Listing = {
  id: string;
  kind: AssetKind;
  title: string;
  summary: string;
  href: string;
  minutes: number;
  level: Level;
  skills: AssetSkill[];
  /** Skill family ids the skills belong to. */
  families: string[];
  /** Seeded role ids whose requirements overlap this listing's skills. */
  roles: string[];
  industry: string;
  roleLabel: string;
  creator: { name: string; profileId: string | null };
  /** Learners and finishers, when counted (coach lessons). */
  learners: number | null;
  quality: QualityResult;
  updatedAt: string;
};

const familyOf = new Map(skillTaxonomy.map((skill) => [skill.slug, skill.familyId]));

export const familiesOf = (skills: AssetSkill[]): string[] => [...new Set(skills.flatMap((item) => familyOf.get(item.skill) ?? []))];

/** Roles that ask for any of these skills, most relevant first. A role counts when the overlap weighs at least two. */
export function rolesFor(skills: AssetSkill[]): string[] {
  const have = new Set(skills.map((item) => item.skill));
  return TARGET_ROLES.map((role) => ({ id: role.id, weight: role.requirements.filter((need) => have.has(need.skill)).reduce((sum, need) => sum + need.criticality, 0) }))
    .filter((item) => item.weight >= 2)
    .sort((a, b) => b.weight - a.weight)
    .map((item) => item.id);
}

export const LEVEL_LABEL: Record<Level, string> = { foundational: "Foundational", working: "Working", advanced: "Advanced" };
export const levelOf = (proficiency: string | undefined): Level => (proficiency === "foundational" ? "foundational" : proficiency === "advanced" || proficiency === "proficient" || proficiency === "expert" ? "advanced" : "working");
