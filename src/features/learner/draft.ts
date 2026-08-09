import type { AssessmentAnswers, PillarScore } from "@/features/assessment/model";

export type LearnerDraft = {
  name: string;
  currentRole: string;
  focus: "career" | "leadership" | "business" | "ai";
  challenge: string;
  goal: string;
};

export type LearnerSnapshot = {
  draft: LearnerDraft;
  answers?: AssessmentAnswers;
  scores?: PillarScore[];
  completedSkillShots?: string[];
  evidence?: Array<{
    skillShotSlug: string;
    pillarId: PillarScore["id"];
    scoreDelta: number;
    createdAt: string;
  }>;
};

export const emptyLearnerDraft: LearnerDraft = {
  name: "",
  currentRole: "",
  focus: "career",
  challenge: "",
  goal: "",
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