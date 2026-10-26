import type { LearningAsset, AssetKind } from "./assets";
import { validAssetSkills } from "./assets";
import type { SkillGap } from "./gaps";

/**
 * Turns ranked gaps into an ordered pathway. For each gap it picks the best asset that moves that skill furthest per minute,
 * preferring a coach's lesson, then a designed Skill Shot, then the older formats, then a kit. Gaps with no asset are listed
 * as content gaps, which tells the platform what to commission next.
 */
const KIND_PREFERENCE: Record<AssetKind, number> = { "coach-lesson": 1.3, "designed-skill-shot": 1.2, "skill-shot": 1, kit: 0.9 };

export type PathwayStep = {
  order: number;
  skill: string;
  name: string;
  asset: LearningAsset;
  targetLevel: number;
  targetBehaviour: string;
  practice: string;
  evidenceSignal: string;
  whyNow: string;
  minutes: number;
};
export type Pathway = { steps: PathwayStep[]; contentGaps: SkillGap[]; checkFirst: SkillGap[]; totalMinutes: number; budgetMinutes: number; deferred: PathwayStep[] };

export function planPathway(
  gaps: SkillGap[],
  assets: LearningAsset[],
  options: { budgetMinutes: number; behaviours?: Record<string, string> } = { budgetMinutes: 600 },
): Pathway {
  const used = new Set<string>();
  const steps: PathwayStep[] = [];
  const contentGaps: SkillGap[] = [];
  const checkFirst = gaps.filter((gap) => gap.status === "check-first");
  const open = gaps.filter((gap) => gap.status === "gap");

  for (const gap of open) {
    const candidates = assets
      .filter((asset) => !used.has(asset.id))
      .map((asset) => ({ asset, hit: validAssetSkills(asset.skills).find((item) => item.skill === gap.skill) }))
      .filter((item): item is { asset: LearningAsset; hit: { skill: string; toLevel: number } } => Boolean(item.hit))
      .map(({ asset, hit }) => {
        const lift = Math.min(hit.toLevel, gap.required) - (gap.current ?? 0);
        return { asset, hit, score: (Math.max(lift, 0.1) / Math.max(asset.minutes, 1)) * KIND_PREFERENCE[asset.kind] };
      })
      .sort((a, b) => b.score - a.score);
    const best = candidates[0];
    if (!best) {
      contentGaps.push(gap);
      continue;
    }
    used.add(best.asset.id);
    steps.push({
      order: steps.length + 1,
      skill: gap.skill,
      name: gap.name,
      asset: best.asset,
      targetLevel: Number(Math.min(best.hit.toLevel, gap.required).toFixed(1)),
      targetBehaviour: options.behaviours?.[gap.skill] ?? `Use ${gap.name.toLowerCase()} in a real piece of work this week.`,
      practice: best.asset.practice,
      evidenceSignal: "A correct check-in plus one piece of your own work that shows the behaviour.",
      whyNow: gap.why,
      minutes: best.asset.minutes,
    });
  }

  const inBudget: PathwayStep[] = [];
  const deferred: PathwayStep[] = [];
  let total = 0;
  for (const step of steps) {
    if (total + step.minutes <= options.budgetMinutes || inBudget.length === 0) {
      inBudget.push(step);
      total += step.minutes;
    } else deferred.push(step);
  }
  inBudget.forEach((step, index) => (step.order = index + 1));
  return { steps: inBudget, deferred, contentGaps, checkFirst, totalMinutes: total, budgetMinutes: options.budgetMinutes };
}
