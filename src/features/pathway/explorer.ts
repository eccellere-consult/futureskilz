import { skillTaxonomy } from "../../domain/skills/taxonomy";
import { estimateFor, type SkillEstimate } from "./estimate";
import { TARGET_ROLES, type TargetRole } from "./roles";

/**
 * Career Explorer: from what a learner can do now, which roles are near, what carries over, what is missing, and how ready they
 * look. Every figure rests on estimates that are mostly self-reported, so readiness is shown with how much of it is checked,
 * never as a verdict.
 */
export type Readiness = {
  /** 0 to 1: how much of what the role needs, weighted by how critical each skill is. A skill with no estimate counts as zero. */
  score: number;
  band: "too-little-evidence" | "early" | "building" | "close" | "ready-to-try";
  /** Share of the role's weight where we have any estimate at all. */
  checkedShare: number;
  /** Share of the role's weight backed by described situations or completed lessons, not only the first self-rating. */
  evidencedShare: number;
};

export type SkillView = { skill: string; name: string; required: number; current: number | null; criticality: 1 | 2 | 3 };
export type RoleView = {
  role: TargetRole;
  readiness: Readiness;
  carriesOver: SkillView[];
  missing: SkillView[];
  /** 0 to 1 when a starting role is known: how much of the two roles' skills overlap. */
  closeness: number | null;
};

const names = new Map(skillTaxonomy.map((skill) => [skill.slug, skill.name]));
const MET_TOLERANCE = 0.5;
const EVIDENCED = new Set(["diagnostic", "evidence"]);

export const BAND_LABEL: Record<Readiness["band"], string> = {
  "too-little-evidence": "Too little evidence to say",
  early: "Early",
  building: "Building",
  close: "Close",
  "ready-to-try": "Ready to try",
};

export function readinessFor(role: TargetRole, estimates: Map<string, SkillEstimate>): Readiness {
  let total = 0;
  let covered = 0;
  let checked = 0;
  let evidenced = 0;
  for (const need of role.requirements) {
    const estimate = estimateFor(estimates, need.skill);
    total += need.criticality;
    if (estimate.level !== null) {
      checked += need.criticality;
      covered += need.criticality * (Math.min(estimate.level, need.level) / need.level);
      if (EVIDENCED.has(estimate.source)) evidenced += need.criticality;
    }
  }
  const score = total ? covered / total : 0;
  const checkedShare = total ? checked / total : 0;
  const evidencedShare = total ? evidenced / total : 0;
  // "Ready to try" needs more than a self-rating behind it: at least half of what the role asks for must rest on situations the
  // learner described or lessons they completed. Without that, the best this can say is "close".
  const high = score >= 0.8 && evidencedShare >= 0.5 ? "ready-to-try" : "close";
  const band: Readiness["band"] = checkedShare < 0.5 ? "too-little-evidence" : score < 0.35 ? "early" : score < 0.6 ? "building" : score < 0.8 ? "close" : high;
  return { score: Number(score.toFixed(3)), band, checkedShare: Number(checkedShare.toFixed(3)), evidencedShare: Number(evidencedShare.toFixed(3)) };
}

/** How alike two roles are in what they ask for: shared weight over total weight, so a role that asks for more is not "close". */
export function roleSimilarity(a: TargetRole, b: TargetRole): number {
  const weights = (role: TargetRole) => new Map(role.requirements.map((need) => [need.skill, need.criticality * need.level]));
  const wa = weights(a);
  const wb = weights(b);
  let shared = 0;
  let union = 0;
  for (const skill of new Set([...wa.keys(), ...wb.keys()])) {
    shared += Math.min(wa.get(skill) ?? 0, wb.get(skill) ?? 0);
    union += Math.max(wa.get(skill) ?? 0, wb.get(skill) ?? 0);
  }
  return union ? Number((shared / union).toFixed(3)) : 0;
}

const viewOf = (need: TargetRole["requirements"][number], estimates: Map<string, SkillEstimate>): SkillView => ({ skill: need.skill, name: names.get(need.skill) ?? need.skill, required: need.level, current: estimateFor(estimates, need.skill).level, criticality: need.criticality });

export function viewRole(role: TargetRole, estimates: Map<string, SkillEstimate>, from?: TargetRole): RoleView {
  const views = role.requirements.map((need) => viewOf(need, estimates));
  return {
    role,
    readiness: readinessFor(role, estimates),
    carriesOver: views.filter((v) => v.current !== null && v.current >= v.required - MET_TOLERANCE).sort((a, b) => b.criticality - a.criticality),
    missing: views.filter((v) => v.current === null || v.current < v.required - MET_TOLERANCE).sort((a, b) => b.criticality - a.criticality || (a.current ?? -1) - (b.current ?? -1)),
    closeness: from ? (from.id === role.id ? 1 : roleSimilarity(from, role)) : null,
  };
}

/** Every seeded role, nearest first. With a starting role, closeness breaks ties; without one, readiness alone orders them. */
export function rankRoles(estimates: Map<string, SkillEstimate>, from?: TargetRole): RoleView[] {
  return TARGET_ROLES.map((role) => viewRole(role, estimates, from)).sort((a, b) => {
    const byScore = b.readiness.score - a.readiness.score;
    return Math.abs(byScore) > 0.02 ? byScore : (b.closeness ?? 0) - (a.closeness ?? 0) || a.role.title.localeCompare(b.role.title);
  });
}

const words = (text: string): string[] => text.toLowerCase().match(/[a-z]{3,}/g) ?? [];

/** A job title is a hypothesis: this suggests the nearest seeded role, to be confirmed by the learner, or none. */
export function suggestRoleForTitle(title: string): TargetRole | null {
  const have = new Set(words(title));
  if (have.size === 0) return null;
  let best: { role: TargetRole; score: number } | null = null;
  for (const role of TARGET_ROLES) {
    const need = words(role.title).filter((word) => !["the", "and"].includes(word));
    const hit = need.filter((word) => have.has(word)).length;
    const score = hit / need.length;
    if (score >= 0.99 || (need.length >= 3 && score >= 0.66)) if (!best || score > best.score || (score === best.score && need.length > words(best.role.title).length)) best = { role, score };
  }
  return best?.role ?? null;
}
