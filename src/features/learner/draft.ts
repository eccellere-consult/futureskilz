import type { AssessmentAnswers, PillarScore } from "@/features/assessment/model";
import type {
  ChallengeId,
  FocusId,
  HorizonId,
  ResponsibilityLevel,
  SkillFamilyId,
  WeeklyMinutes,
} from "./discovery-model";

export type LearnerDraft = {
  name: string;
  currentRole: string;
  responsibilityLevel: ResponsibilityLevel | "";
  focus: FocusId | "";
  horizon: HorizonId | "";
  priorityFamilies: SkillFamilyId[];
  prioritySkills: string[];
  challengeType: ChallengeId | "";
  challenge: string;
  goal: string;
  weeklyMinutes: WeeklyMinutes | 0;
};

export type LearnerSnapshot = {
  draft: LearnerDraft;
  answers?: AssessmentAnswers;
  scores?: PillarScore[];
  completedSkillShots?: string[];
  /** Signed-in learners: levels held on the account that have evidence behind them, for every skill and not only the baseline five. */
  skillLevels?: Array<{ skill: string; level: number; confidence: number; evidenceCount: number }>;
  /** Signed-in learners: what the conversational diagnostic found, from recent situations they described. */
  diagnostic?: Array<{ skill: string; level: number; confidence: number; kind: "reported-behaviour" | "reported-behaviour-with-result" }>;
  /** Signed-in learners: designed Skill Shots whose check was passed. */
  completedDesigned?: string[];
  evidence?: Array<{
    skillShotSlug: string;
    pillarId: PillarScore["id"];
    scoreDelta: number;
    createdAt: string;
  }>;
  /** Practice text and check-in answers, kept so the server can verify and import them. */
  skillShotResults?: Array<{
    slug: string;
    practice: string;
    checkInAnswer: number;
    completedAt: string;
  }>;
  /** Present when the snapshot was loaded from the learner's account. */
  account?: {
    displayName: string;
    welcomeSummary: string | null;
    welcomeSummarySource: "ai" | "template" | null;
  };
};

export const emptyLearnerDraft: LearnerDraft = {
  name: "",
  currentRole: "",
  responsibilityLevel: "",
  focus: "",
  horizon: "",
  priorityFamilies: [],
  prioritySkills: [],
  challengeType: "",
  challenge: "",
  goal: "",
  weeklyMinutes: 0,
};

const storageKey = "futureskilz.learner-draft.v1";

export function loadLearnerSnapshot(): LearnerSnapshot {
  if (typeof window === "undefined") {
    return { draft: emptyLearnerDraft };
  }

  const storedValue = window.localStorage.getItem(storageKey);

  if (!storedValue) {
    return { draft: emptyLearnerDraft };
  }

  try {
    const snapshot = JSON.parse(storedValue) as LearnerSnapshot;
    return { ...snapshot, draft: { ...emptyLearnerDraft, ...snapshot.draft } };
  } catch {
    return { draft: emptyLearnerDraft };
  }
}

export function saveLearnerSnapshot(snapshot: LearnerSnapshot): void {
  window.localStorage.setItem(storageKey, JSON.stringify(snapshot));
}
export function clearLearnerSnapshot(): void {
  window.localStorage.removeItem(storageKey);
}
