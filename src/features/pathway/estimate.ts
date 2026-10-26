import type { PillarId, PillarScore } from "../assessment/model";

/**
 * What we think a learner can do now, per capability. The baseline is a short self-rating on five areas, so it is a **hypothesis**:
 * it is spread to related capabilities at lower confidence, and capabilities it says nothing about stay "not yet assessed".
 * Evidence (a completed lesson with a correct check-in) moves a level a little and raises confidence. Nothing here claims
 * psychometric precision.
 */

export type EstimateSource = "baseline" | "inferred" | "evidence" | "none";
export type SkillEstimate = { skill: string; level: number | null; confidence: number; source: EstimateSource };

/** The baseline area each capability is read from. The first in a list is the anchor. */
export const PILLAR_SKILLS: Record<PillarId, string[]> = {
  "digital-fluency": ["ai-literacy", "digital-literacy", "technology-literacy", "data-literacy", "automation", "generative-ai", "prompting"],
  "critical-thinking": ["critical-thinking", "analytical-thinking", "problem-solving", "decision-making", "judgment"],
  creativity: ["creative-thinking", "curiosity"],
  "human-skills": ["influence", "communication", "collaboration", "empathy", "active-listening", "stakeholder-management"],
  "adaptive-leadership": ["adaptability", "leadership", "resilience", "learning-agility", "growth-mindset"],
};

export const BASELINE_CONFIDENCE = 0.3;
export const INFERRED_CONFIDENCE = 0.2;
export const INFERRED_DISCOUNT = 0.9;
export const EVIDENCE_LEVEL_GAIN = 0.5;
export const EVIDENCE_CONFIDENCE_GAIN = 0.1;

/** The stored scale is 0 to 5; the baseline scores run 25 to 100. */
export const levelFromScore = (score: number): number => Math.max(0, Math.min(5, score / 20));

export type Evidence = { skill: string; correct: boolean };

export function estimateSkills(scores: PillarScore[] | undefined, evidence: Evidence[] = []): Map<string, SkillEstimate> {
  const out = new Map<string, SkillEstimate>();
  for (const score of scores ?? []) {
    const level = levelFromScore(score.score);
    (PILLAR_SKILLS[score.id] ?? []).forEach((skill, index) => {
      const existing = out.get(skill);
      const anchor = index === 0;
      const candidate: SkillEstimate = anchor
        ? { skill, level, confidence: BASELINE_CONFIDENCE, source: "baseline" }
        : { skill, level: Number((level * INFERRED_DISCOUNT).toFixed(2)), confidence: INFERRED_CONFIDENCE, source: "inferred" };
      if (!existing || candidate.confidence > existing.confidence) out.set(skill, candidate);
    });
  }
  for (const item of evidence) {
    if (!item.correct) continue;
    const current = out.get(item.skill) ?? { skill: item.skill, level: 0, confidence: 0, source: "none" as EstimateSource };
    out.set(item.skill, {
      skill: item.skill,
      level: Math.min(5, (current.level ?? 0) + EVIDENCE_LEVEL_GAIN),
      confidence: Math.min(1, current.confidence + EVIDENCE_CONFIDENCE_GAIN),
      source: "evidence",
    });
  }
  return out;
}

export const estimateFor = (estimates: Map<string, SkillEstimate>, skill: string): SkillEstimate =>
  estimates.get(skill) ?? { skill, level: null, confidence: 0, source: "none" };

export const SOURCE_LABEL: Record<EstimateSource, string> = {
  baseline: "From your baseline answer (self-report)",
  inferred: "Inferred from a related baseline answer",
  evidence: "Includes evidence from lessons you completed",
  none: "Not yet assessed",
};
