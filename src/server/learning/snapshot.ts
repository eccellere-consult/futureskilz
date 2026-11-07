import { pillars, scoreAssessment, type PillarId, type PillarScore } from "../../features/assessment/model";
import { getSkillShot } from "../../features/journey/model";
import type { LearnerDraft, LearnerSnapshot } from "../../features/learner/draft";
import type { ImportableSnapshot, SkillShotResult } from "../../features/learner/snapshot-schema";

/** Each baseline pillar is stored against one anchor capability in the Skill Graph. */
export const pillarAnchorSkills: Record<PillarId, string> = {
  "digital-fluency": "ai-literacy",
  "critical-thinking": "critical-thinking",
  creativity: "creative-thinking",
  "human-skills": "influence",
  "adaptive-leadership": "adaptability",
};

export const baselineAssessmentTitle = "FutureSkilz baseline";
export const baselineRubricVersion = "baseline-v1";
export const baselineConfidence = 0.3;
export const checkInLevelGain = 0.5;
export const checkInConfidenceGain = 0.1;
export const checkInEvidenceType = "check-in";
export const skillShotEvidenceSource = (slug: string) => `skill-shot:${slug}`;
export const designedEvidenceType = "designed-check";
export const designedEvidenceSource = (id: string, skill: string) => `designed:${id}:${skill}`;

/** The 0–5 proficiency level is the single stored scale; 0–100 is a display projection. */
export function levelFromScore(score: number): number {
  return Math.max(0, Math.min(5, score / 20));
}

export function scoreFromLevel(level: number): number {
  return Math.max(0, Math.min(100, Math.round(level * 20)));
}

export function labelForScore(score: number): PillarScore["level"] {
  return score >= 90 ? "Leading" : score >= 65 ? "Practising" : score >= 40 ? "Developing" : "Foundation";
}

export function isCorrectCheckIn(slug: string, answer: number): boolean {
  const skillShot = getSkillShot(slug);
  return Boolean(skillShot) && skillShot?.checkIn.correctIndex === answer;
}

export function hasCompleteAnswers(answers: ImportableSnapshot["answers"]): boolean {
  return pillars.every(({ id }) => answers?.[id] !== undefined);
}

export type VerifiedResult = SkillShotResult & { pillarId: PillarId; correct: boolean };

/** Keeps known Skill Shots only, one result per slug, and marks whether the check-in was right. */
export function verifySkillShotResults(results: SkillShotResult[] = []): VerifiedResult[] {
  const seen = new Set<string>();
  const verified: VerifiedResult[] = [];

  for (const result of results) {
    const skillShot = getSkillShot(result.slug);
    if (!skillShot || seen.has(result.slug)) continue;
    seen.add(result.slug);
    verified.push({ ...result, pillarId: skillShot.pillarId, correct: isCorrectCheckIn(result.slug, result.checkInAnswer) });
  }

  return verified;
}

/** Baseline levels per anchor skill, plus the gain from each correct check-in. */
export function levelsFromImport(snapshot: ImportableSnapshot): Map<string, number> {
  const levels = new Map<string, number>();
  if (!snapshot.answers || !hasCompleteAnswers(snapshot.answers)) return levels;

  for (const pillar of scoreAssessment(snapshot.answers)) {
    levels.set(pillarAnchorSkills[pillar.id], levelFromScore(pillar.score));
  }

  for (const result of verifySkillShotResults(snapshot.skillShotResults)) {
    if (!result.correct) continue;
    const anchor = pillarAnchorSkills[result.pillarId];
    levels.set(anchor, Math.min(5, (levels.get(anchor) ?? 0) + checkInLevelGain));
  }

  return levels;
}

export type StoredLearnerState = {
  displayName: string;
  profile: {
    currentRole: string | null;
    responsibilityLevel: string | null;
    focus: string | null;
    horizon: string | null;
    priorityFamilies: string[] | null;
    challengeType: string | null;
    challenge: string | null;
    weeklyMinutes: number | null;
    welcomeSummary: string | null;
    welcomeSummarySource: string | null;
  } | null;
  goal: { title: string; skillSlugs: string[] } | null;
  answers: Partial<Record<PillarId, number>>;
  anchorLevels: Map<string, number>;
  results: Array<{ slug: string; practice: string; checkInAnswer: number; completedAt: Date }>;
  evidence: Array<{ slug: string; createdAt: Date }>;
  /** Every held level with evidence behind it. */
  skillLevels?: Array<{ skill: string; level: number; confidence: number; evidenceCount: number }>;
  designedEvidenceSources?: string[];
};

/** Projects stored rows back into the browser snapshot shape the existing pages render. */
export function projectSnapshot(state: StoredLearnerState): LearnerSnapshot {
  const profile = state.profile;
  const draft: LearnerDraft = {
    name: state.displayName,
    currentRole: profile?.currentRole ?? "",
    responsibilityLevel: (profile?.responsibilityLevel ?? "") as LearnerDraft["responsibilityLevel"],
    focus: (profile?.focus ?? "") as LearnerDraft["focus"],
    horizon: (profile?.horizon ?? "") as LearnerDraft["horizon"],
    priorityFamilies: (profile?.priorityFamilies ?? []) as LearnerDraft["priorityFamilies"],
    prioritySkills: state.goal?.skillSlugs ?? [],
    challengeType: (profile?.challengeType ?? "") as LearnerDraft["challengeType"],
    challenge: profile?.challenge ?? "",
    goal: state.goal?.title ?? "",
    weeklyMinutes: (profile?.weeklyMinutes ?? 0) as LearnerDraft["weeklyMinutes"],
  };

  const snapshot: LearnerSnapshot = {
    draft,
    account: {
      displayName: state.displayName,
      welcomeSummary: profile?.welcomeSummary ?? null,
      welcomeSummarySource: (profile?.welcomeSummarySource as "ai" | "template" | null) ?? null,
    },
  };

  snapshot.skillLevels = state.skillLevels ?? [];
  snapshot.completedDesigned = [...new Set((state.designedEvidenceSources ?? []).flatMap((source) => (source.startsWith("designed:") ? [source.split(":")[1]] : [])))];

  if (!hasCompleteAnswers(state.answers)) return snapshot;

  snapshot.answers = state.answers;
  snapshot.scores = scoreAssessment(state.answers).map((pillar) => {
    const level = state.anchorLevels.get(pillarAnchorSkills[pillar.id]);
    const score = level === undefined ? pillar.score : scoreFromLevel(level);
    return { ...pillar, score, level: labelForScore(score) };
  });
  snapshot.completedSkillShots = state.evidence.map(({ slug }) => slug);
  snapshot.evidence = state.evidence.flatMap(({ slug, createdAt }) => {
    const skillShot = getSkillShot(slug);
    return skillShot
      ? [{ skillShotSlug: slug, pillarId: skillShot.pillarId, scoreDelta: scoreFromLevel(checkInLevelGain), createdAt: createdAt.toISOString() }]
      : [];
  });
  snapshot.skillShotResults = state.results.map((result) => ({ ...result, completedAt: result.completedAt.toISOString() }));

  return snapshot;
}
