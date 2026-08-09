export const skillFamilies = [
  {
    id: "human-intelligence",
    name: "Thinking & problem solving",
    category: "Human Intelligence",
    plainLanguage: "Understand complexity, make sound decisions and create better options.",
    skills: [
      "Analytical thinking", "Critical thinking", "Creative thinking", "Strategic thinking", "Systems thinking",
      "Problem solving", "Decision making", "Judgment", "Curiosity", "Learning agility",
    ],
  },
  {
    id: "human-to-human-intelligence",
    name: "Working with people",
    category: "Human-to-Human Intelligence",
    plainLanguage: "Communicate, collaborate and move people toward shared outcomes.",
    skills: [
      "Communication", "Executive communication", "Collaboration", "Leadership", "Influence", "Negotiation",
      "Empathy", "Active listening", "Conflict management", "Coaching", "Stakeholder management",
    ],
  },
  {
    id: "self-intelligence",
    name: "Leading yourself",
    category: "Self Intelligence",
    plainLanguage: "Stay effective, adaptable and grounded as demands change.",
    skills: [
      "Self-awareness", "Resilience", "Adaptability", "Growth mindset", "Motivation", "Emotional regulation",
      "Personal effectiveness", "Executive presence",
    ],
  },
  {
    id: "ai-intelligence",
    name: "Working with AI",
    category: "AI Intelligence",
    plainLanguage: "Use AI thoughtfully to improve research, analysis, decisions and execution.",
    skills: [
      "AI literacy", "Generative AI", "Prompting", "AI collaboration", "AI-assisted research",
      "AI-assisted analysis", "AI-assisted decision making", "Agentic AI", "AI ethics", "AI governance",
    ],
  },
  {
    id: "digital-intelligence",
    name: "Digital & data fluency",
    category: "Digital Intelligence",
    plainLanguage: "Use data, technology and automation confidently and safely.",
    skills: [
      "Data literacy", "Digital literacy", "Technology literacy", "Cybersecurity awareness", "Automation",
    ],
  },
  {
    id: "functional-intelligence",
    name: "Business execution",
    category: "Functional Intelligence",
    plainLanguage: "Apply core business disciplines to turn intent into measurable results.",
    skills: [
      "Strategy", "Finance", "Marketing", "Operations", "Product management", "Project management",
    ],
  },
] as const;

export type SkillFamilyId = (typeof skillFamilies)[number]["id"];

export function slugifySkill(value: string): string {
  return value.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-").replaceAll(/(^-|-$)/g, "");
}

export const skillTaxonomy = skillFamilies.flatMap((family) =>
  family.skills.map((name) => ({
    name,
    slug: slugifySkill(name),
    familyId: family.id,
    category: family.category,
  })),
);

export type SkillTaxonomyItem = (typeof skillTaxonomy)[number];

export function skillsForFamilies(familyIds: SkillFamilyId[]): SkillTaxonomyItem[] {
  return skillTaxonomy.filter((skill) => familyIds.includes(skill.familyId));
}