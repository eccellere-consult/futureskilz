import type { PillarId, PillarScore } from "../assessment/model";

/**
 * What we think a learner can do now, per capability. The baseline is a short self-rating on five areas, so it is a **hypothesis**:
 * it is spread to related capabilities at lower confidence, and capabilities it says nothing about stay "not yet assessed".
 * Evidence (a completed lesson with a correct check-in) moves a level a little and raises confidence. Nothing here claims
 * psychometric precision.
 */

export type EstimateSource = "baseline" | "inferred" | "diagnostic" | "evidence" | "none";
export type SkillEstimate = { skill: string; level: number | null; confidence: number; source: EstimateSource; /** Diagnostic only: the learner also described a result. */ withResult?: boolean };

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

/** A correct check on a skill. `ceiling` is how far that lesson can take someone, so one lesson never claims more than it teaches. */
export type Evidence = { skill: string; correct: boolean; ceiling?: number };
/** Levels the account already holds, with how many pieces of evidence stand behind them. */
export type StoredSkillLevel = { skill: string; level: number; confidence: number; evidenceCount: number };

/** What the conversational diagnostic found about a skill, from recent situations the learner described. */
export type DiagnosticLevel = { skill: string; level: number; confidence: number; kind: "reported-behaviour" | "reported-behaviour-with-result" };

export function estimateSkills(scores: PillarScore[] | undefined, evidence: Evidence[] = [], stored: StoredSkillLevel[] = [], diagnostic: DiagnosticLevel[] = []): Map<string, SkillEstimate> {
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
  // Answers about recent situations beat a short self-rating where they carry at least as much confidence.
  for (const item of diagnostic) {
    const existing = out.get(item.skill);
    if (!existing || item.confidence >= existing.confidence) out.set(item.skill, { skill: item.skill, level: item.level, confidence: item.confidence, source: "diagnostic", withResult: item.kind === "reported-behaviour-with-result" });
  }
  for (const item of evidence) {
    if (!item.correct) continue;
    const current = out.get(item.skill) ?? { skill: item.skill, level: 0, confidence: 0, source: "none" as EstimateSource };
    const now = current.level ?? 0;
    out.set(item.skill, {
      skill: item.skill,
      level: Math.max(now, Math.min(item.ceiling ?? 5, now + EVIDENCE_LEVEL_GAIN)),
      confidence: Math.min(1, current.confidence + EVIDENCE_CONFIDENCE_GAIN),
      source: "evidence",
    });
  }
  // What the account holds has evidence behind it. A level earned only from lessons starts at zero, so it can sit below what the
  // baseline or the learner's own descriptions already say; evidence adds confidence and never lowers a level.
  for (const row of stored) {
    if (row.evidenceCount <= 0) continue;
    const prior = out.get(row.skill);
    out.set(row.skill, {
      skill: row.skill,
      level: Math.max(prior?.level ?? 0, row.level),
      confidence: Math.max(prior?.confidence ?? 0, row.confidence),
      source: "evidence",
    });
  }
  return out;
}

export const labelFor = (estimate: SkillEstimate): string =>
  estimate.source === "diagnostic" && estimate.withResult ? "From a recent situation and the result you described (self-reported)" : SOURCE_LABEL[estimate.source];

export const estimateFor = (estimates: Map<string, SkillEstimate>, skill: string): SkillEstimate =>
  estimates.get(skill) ?? { skill, level: null, confidence: 0, source: "none" };

export const SOURCE_LABEL: Record<EstimateSource, string> = {
  diagnostic: "From your answers about recent situations (self-reported behaviour)",
  baseline: "From your baseline answer (self-report)",
  inferred: "Inferred from a related baseline answer",
  evidence: "Includes evidence from lessons you completed",
  none: "Not yet assessed",
};
