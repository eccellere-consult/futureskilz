/**
 * Roles a learner can aim for, each with the capabilities it needs and how far. These are **starting hypotheses**, written to be
 * checked with employers and coaches: they say what a role commonly asks for, not what any one employer requires. Levels use the
 * single stored scale (0 to 5; 1 foundation, 2 developing, 3 practising, 4 advanced, 5 leading). Criticality says how much the role
 * leans on a capability (3 core, 2 important, 1 helpful).
 */

export type Requirement = { skill: string; level: number; criticality: 1 | 2 | 3 };
export type TargetRole = { id: string; title: string; summary: string; requirements: Requirement[] };

const need = (skill: string, level: number, criticality: 1 | 2 | 3): Requirement => ({ skill, level, criticality });

export const TARGET_ROLES: TargetRole[] = [
  {
    id: "production-planner",
    title: "Production Planner",
    summary: "Turns demand into a schedule the plant can keep, and re-plans calmly when reality changes.",
    requirements: [need("operations", 3.5, 3), need("analytical-thinking", 3, 3), need("problem-solving", 3, 3), need("decision-making", 3, 3), need("data-literacy", 3, 2), need("communication", 3, 2), need("collaboration", 3, 2), need("adaptability", 3, 2)],
  },
  {
    id: "operations-manager",
    title: "Operations Manager",
    summary: "Runs a team and a process to deliver on time, on cost and on quality.",
    requirements: [need("operations", 4, 3), need("leadership", 3.5, 3), need("problem-solving", 3.5, 3), need("decision-making", 3.5, 3), need("stakeholder-management", 3, 2), need("coaching", 3, 2), need("data-literacy", 3, 2), need("resilience", 3, 1)],
  },
  {
    id: "supply-chain-analyst",
    title: "Supply Chain Analyst",
    summary: "Uses data to find where goods are delayed, short or costly, and what to change.",
    requirements: [need("data-literacy", 3.5, 3), need("analytical-thinking", 3.5, 3), need("operations", 3, 3), need("problem-solving", 3, 2), need("communication", 3, 2), need("technology-literacy", 2.5, 1), need("ai-assisted-analysis", 2.5, 1)],
  },
  {
    id: "quality-engineer",
    title: "Quality Engineer",
    summary: "Finds the cause of defects and makes the fix last.",
    requirements: [need("problem-solving", 4, 3), need("analytical-thinking", 3.5, 3), need("data-literacy", 3, 3), need("critical-thinking", 3, 2), need("communication", 3, 2), need("collaboration", 3, 2), need("operations", 3, 2)],
  },
  {
    id: "project-manager",
    title: "Project Manager",
    summary: "Gets a defined piece of work finished with the people, time and money available.",
    requirements: [need("project-management", 4, 3), need("stakeholder-management", 3.5, 3), need("communication", 3.5, 3), need("decision-making", 3, 2), need("problem-solving", 3, 2), need("leadership", 3, 2), need("adaptability", 3, 2), need("conflict-management", 2.5, 1)],
  },
  {
    id: "business-analyst",
    title: "Business Analyst",
    summary: "Clarifies what the business needs and turns it into a clear, testable requirement.",
    requirements: [need("analytical-thinking", 3.5, 3), need("communication", 3.5, 3), need("problem-solving", 3, 3), need("stakeholder-management", 3, 2), need("data-literacy", 3, 2), need("critical-thinking", 3, 2), need("active-listening", 3, 2), need("ai-assisted-analysis", 2.5, 1)],
  },
  {
    id: "data-analyst",
    title: "Data Analyst",
    summary: "Turns data into answers people can act on, and says how sure the answer is.",
    requirements: [need("data-literacy", 4, 3), need("analytical-thinking", 4, 3), need("critical-thinking", 3, 2), need("communication", 3, 2), need("technology-literacy", 3, 2), need("ai-assisted-analysis", 3, 2), need("problem-solving", 3, 1)],
  },
  {
    id: "product-manager",
    title: "Product Manager",
    summary: "Decides what to build and why, with customers, engineers and the business.",
    requirements: [need("product-management", 4, 3), need("strategic-thinking", 3.5, 3), need("decision-making", 3.5, 3), need("stakeholder-management", 3.5, 3), need("communication", 3.5, 2), need("data-literacy", 3, 2), need("influence", 3, 2), need("creative-thinking", 3, 1)],
  },
  {
    id: "ai-product-manager",
    title: "AI Product Manager",
    summary: "Leads products that use AI: what it can and cannot do, how it is checked, and how it is governed.",
    requirements: [need("product-management", 4, 3), need("ai-literacy", 4, 3), need("ai-governance", 3, 2), need("ai-ethics", 3, 2), need("generative-ai", 3.5, 2), need("data-literacy", 3.5, 2), need("stakeholder-management", 3.5, 3), need("decision-making", 3.5, 2), need("agentic-ai", 3, 1)],
  },
  {
    id: "marketing-manager",
    title: "Marketing Manager",
    summary: "Understands customers, plans campaigns and measures what worked.",
    requirements: [need("marketing", 4, 3), need("communication", 3.5, 3), need("creative-thinking", 3.5, 2), need("data-literacy", 3, 2), need("strategic-thinking", 3, 2), need("stakeholder-management", 3, 2), need("generative-ai", 3, 1)],
  },
  {
    id: "sales-manager",
    title: "Sales Manager",
    summary: "Builds a pipeline and a team that wins customers fairly and repeatedly.",
    requirements: [need("negotiation", 3.5, 3), need("influence", 3.5, 3), need("leadership", 3.5, 3), need("communication", 3.5, 2), need("coaching", 3, 2), need("data-literacy", 3, 1), need("resilience", 3, 2)],
  },
  {
    id: "customer-success-manager",
    title: "Customer Success Manager",
    summary: "Helps customers get lasting value, and spots trouble before they leave.",
    requirements: [need("communication", 3.5, 3), need("empathy", 3.5, 3), need("active-listening", 3.5, 3), need("problem-solving", 3, 2), need("stakeholder-management", 3, 2), need("conflict-management", 3, 2), need("data-literacy", 2.5, 1)],
  },
  {
    id: "finance-analyst",
    title: "Finance Analyst",
    summary: "Explains the numbers behind decisions and checks they hold up.",
    requirements: [need("finance", 3.5, 3), need("analytical-thinking", 3.5, 3), need("data-literacy", 3.5, 3), need("critical-thinking", 3, 2), need("communication", 3, 2), need("technology-literacy", 3, 1), need("ai-assisted-analysis", 2.5, 1)],
  },
  {
    id: "hr-business-partner",
    title: "HR Business Partner",
    summary: "Works with leaders on people, capability and change.",
    requirements: [need("stakeholder-management", 3.5, 3), need("coaching", 3.5, 3), need("communication", 3.5, 3), need("empathy", 3.5, 2), need("conflict-management", 3, 2), need("influence", 3, 2), need("data-literacy", 2.5, 1), need("ai-ethics", 2.5, 1)],
  },
  {
    id: "first-time-team-leader",
    title: "First-time Team Leader",
    summary: "Moves from doing the work to getting it done through a team.",
    requirements: [need("leadership", 3, 3), need("coaching", 3, 3), need("communication", 3.5, 3), need("decision-making", 3, 2), need("conflict-management", 2.5, 2), need("emotional-regulation", 3, 2), need("personal-effectiveness", 3, 2), need("self-awareness", 3, 2)],
  },
];

export const getRole = (id: string | null | undefined): TargetRole | undefined => TARGET_ROLES.find((role) => role.id === id);
