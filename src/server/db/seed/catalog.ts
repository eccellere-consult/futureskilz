import { skillTaxonomy, slugifySkill } from "../../../domain/skills/taxonomy";

export type SeedSkill = {
  name: string;
  slug: string;
  category: string;
  description: string;
};

export type SeedRole = {
  title: string;
  slug: string;
  function: string;
  description: string;
  requiredSkills: Array<{ skillSlug: string; targetLevel: number }>;
};

export type SeedSkillRelationship = {
  sourceSkillSlug: string;
  targetSkillSlug: string;
  relationshipType: "prerequisite" | "adjacent";
  weight: number;
};

export const seedSkills: SeedSkill[] = skillTaxonomy.map(({ name, slug, category, definition, observableBehavior }) => ({
  name,
  slug,
  category,
  description: `${definition} Observable signal: ${observableBehavior}`,
}));

function role(
  title: string,
  functionName: string,
  skillTargets: Array<[string, number]>,
): SeedRole {
  return {
    title,
    slug: slugifySkill(title),
    function: functionName,
    description: `${title} capability profile for future-ready work in the AI age.`,
    requiredSkills: skillTargets.map(([skillSlug, targetLevel]) => ({ skillSlug, targetLevel })),
  };
}

const commonLeadershipSkills: Array<[string, number]> = [
  ["critical-thinking", 4], ["communication", 4], ["decision-making", 4], ["ai-literacy", 3],
];

export const seedRoles: SeedRole[] = [
  role("Strategy Consultant", "Strategy", [["strategic-thinking", 5], ["analytical-thinking", 4], ["executive-communication", 4], ["ai-assisted-research", 3]]),
  role("AI Product Manager", "Product", [["product-management", 4], ["ai-literacy", 5], ["ai-collaboration", 4], ["stakeholder-management", 4]]),
  role("Product Manager", "Product", [["product-management", 5], ["creative-thinking", 4], ["data-literacy", 4], ["stakeholder-management", 4]]),
  role("Business Analyst", "Business Analysis", [["analytical-thinking", 5], ["problem-solving", 4], ["data-literacy", 4], ["ai-assisted-analysis", 3]]),
  role("Digital Transformation Leader", "Transformation", [["digital-literacy", 5], ["systems-thinking", 4], ["leadership", 4], ["ai-governance", 3]]),
  role("People Manager", "People", [["leadership", 4], ["coaching", 4], ["empathy", 4], ["conflict-management", 3]]),
  role("Marketing Manager", "Marketing", [["marketing", 5], ["creative-thinking", 4], ["data-literacy", 3], ["ai-collaboration", 3]]),
  role("Operations Manager", "Operations", [["operations", 5], ["problem-solving", 4], ["automation", 3], ["systems-thinking", 4]]),
  role("Finance Manager", "Finance", [["finance", 5], ["analytical-thinking", 4], ["judgment", 4], ["data-literacy", 4]]),
  role("AI Business Analyst", "Business Analysis", [["analytical-thinking", 5], ["ai-assisted-analysis", 5], ["prompting", 4], ["data-literacy", 4]]),
  role("Program Manager", "Program Management", [["project-management", 5], ["stakeholder-management", 4], ["adaptability", 4], ...commonLeadershipSkills]),
  role("Customer Experience Leader", "Customer Experience", [["empathy", 5], ["active-listening", 4], ["systems-thinking", 4], ...commonLeadershipSkills]),
];

export const seedSkillRelationships: SeedSkillRelationship[] = [
  { sourceSkillSlug: "analytical-thinking", targetSkillSlug: "critical-thinking", relationshipType: "prerequisite", weight: 1 },
  { sourceSkillSlug: "critical-thinking", targetSkillSlug: "decision-making", relationshipType: "prerequisite", weight: 1 },
  { sourceSkillSlug: "creative-thinking", targetSkillSlug: "problem-solving", relationshipType: "adjacent", weight: 0.8 },
  { sourceSkillSlug: "systems-thinking", targetSkillSlug: "strategic-thinking", relationshipType: "adjacent", weight: 0.8 },
  { sourceSkillSlug: "communication", targetSkillSlug: "executive-communication", relationshipType: "prerequisite", weight: 1 },
  { sourceSkillSlug: "empathy", targetSkillSlug: "active-listening", relationshipType: "adjacent", weight: 0.8 },
  { sourceSkillSlug: "collaboration", targetSkillSlug: "stakeholder-management", relationshipType: "adjacent", weight: 0.8 },
  { sourceSkillSlug: "leadership", targetSkillSlug: "coaching", relationshipType: "adjacent", weight: 0.8 },
  { sourceSkillSlug: "self-awareness", targetSkillSlug: "emotional-regulation", relationshipType: "prerequisite", weight: 1 },
  { sourceSkillSlug: "adaptability", targetSkillSlug: "learning-agility", relationshipType: "adjacent", weight: 0.8 },
  { sourceSkillSlug: "ai-literacy", targetSkillSlug: "generative-ai", relationshipType: "prerequisite", weight: 1 },
  { sourceSkillSlug: "prompting", targetSkillSlug: "ai-collaboration", relationshipType: "prerequisite", weight: 1 },
  { sourceSkillSlug: "ai-assisted-research", targetSkillSlug: "ai-assisted-analysis", relationshipType: "adjacent", weight: 0.8 },
  { sourceSkillSlug: "ai-assisted-analysis", targetSkillSlug: "ai-assisted-decision-making", relationshipType: "prerequisite", weight: 1 },
  { sourceSkillSlug: "ai-ethics", targetSkillSlug: "ai-governance", relationshipType: "prerequisite", weight: 1 },
  { sourceSkillSlug: "digital-literacy", targetSkillSlug: "ai-literacy", relationshipType: "prerequisite", weight: 1 },
  { sourceSkillSlug: "data-literacy", targetSkillSlug: "ai-assisted-analysis", relationshipType: "prerequisite", weight: 1 },
  { sourceSkillSlug: "technology-literacy", targetSkillSlug: "automation", relationshipType: "prerequisite", weight: 1 },
  { sourceSkillSlug: "strategy", targetSkillSlug: "strategic-thinking", relationshipType: "adjacent", weight: 0.8 },
  { sourceSkillSlug: "product-management", targetSkillSlug: "stakeholder-management", relationshipType: "adjacent", weight: 0.8 },
];