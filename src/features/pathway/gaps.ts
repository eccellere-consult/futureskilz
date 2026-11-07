import { skillTaxonomy } from "../../domain/skills/taxonomy";
import type { TargetRole } from "./roles";
import { estimateFor, type SkillEstimate } from "./estimate";

/**
 * The gap between what a role asks for and what we think the learner can do now, ranked by what to work on first.
 * A skill with no estimate is flagged "check first": we do not guess a gap we cannot see.
 */
export type Horizon = "90-days" | "6-months" | "12-months" | "exploring";

export const URGENCY: Record<Horizon, number> = { "90-days": 1.3, "6-months": 1.1, "12-months": 0.9, exploring: 0.8 };
const CRITICALITY_WEIGHT: Record<1 | 2 | 3, number> = { 1: 0.7, 2: 1, 3: 1.4 };

export type GapStatus = "gap" | "check-first" | "met";
export type SkillGap = {
  skill: string;
  name: string;
  required: number;
  current: number | null;
  gap: number;
  criticality: 1 | 2 | 3;
  confidence: number;
  status: GapStatus;
  priority: number;
  estimate: SkillEstimate;
  why: string;
};

const names = new Map(skillTaxonomy.map((skill) => [skill.slug, skill.name]));

export const reliability = (confidence: number): number => 0.7 + 0.3 * confidence;

export function computeGaps(
  role: TargetRole,
  estimates: Map<string, SkillEstimate>,
  horizon: Horizon = "6-months",
  /** How many other required skills lean on this one; supplied by the caller from the graph, default none. */
  prerequisiteValue: Record<string, number> = {},
): SkillGap[] {
  const urgency = URGENCY[horizon];
  const gaps = role.requirements.map((req): SkillGap => {
    const estimate = estimateFor(estimates, req.skill);
    const name = names.get(req.skill) ?? req.skill;
    const known = estimate.level !== null;
    const rawGap = known ? Math.max(0, req.level - (estimate.level ?? 0)) : 0;
    const status: GapStatus = !known ? "check-first" : rawGap > 0.25 ? "gap" : "met";
    const lean = 1 + 0.1 * (prerequisiteValue[req.skill] ?? 0);
    // Unknown skills get a modest, fixed weight so they surface for a check without outranking a measured gap.
    const effective = known ? rawGap : 1;
    const priority = status === "met" ? 0 : Number((effective * CRITICALITY_WEIGHT[req.criticality] * urgency * lean * reliability(estimate.confidence)).toFixed(3));
    const why =
      status === "check-first"
        ? `${name} matters for this role and nothing yet shows where you stand, so a short check comes first.`
        : status === "met"
          ? `${name} already looks at or near the level this role needs.`
          : `${name} is ${rawGap.toFixed(1)} levels below what this role needs (${req.level} wanted, about ${(estimate.level ?? 0).toFixed(1)} now).`;
    return { skill: req.skill, name, required: req.level, current: estimate.level, gap: Number(rawGap.toFixed(2)), criticality: req.criticality, confidence: estimate.confidence, status, priority, estimate, why };
  });
  return gaps.sort((a, b) => b.priority - a.priority || b.criticality - a.criticality);
}

export const weeklyBudgetMinutes = (weeklyMinutes: number, horizon: Horizon): number => {
  const weeks = horizon === "90-days" ? 13 : horizon === "6-months" ? 26 : horizon === "12-months" ? 52 : 26;
  return weeklyMinutes * weeks;
};
