import { scoreAssessment, type AssessmentAnswers } from "../assessment/model";
import { applyEvidence, getSkillShot } from "../journey/model";
import {
  clearLearnerSnapshot,
  loadLearnerSnapshot,
  saveLearnerSnapshot,
  type LearnerDraft,
  type LearnerSnapshot,
} from "./draft";

export type SessionUser = { displayName: string; email: string };

let sessionRequest: Promise<SessionUser | null> | undefined;

/** One session lookup per page load; signing in or out reloads the page. */
export function fetchSessionUser(): Promise<SessionUser | null> {
  sessionRequest ??= fetch("/api/auth/session", { cache: "no-store" })
    .then(async (response) => (response.ok ? ((await response.json()) as { user: SessionUser }).user : null))
    .catch(() => null);
  return sessionRequest;
}

async function sendJson<T>(url: string, method: "POST" | "PUT", body: unknown): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(result.error ?? "Something went wrong. Please try again.");
  return result;
}

/** The parts of a browser snapshot the server will accept; scores are always recomputed there. */
export function toImportable(snapshot: LearnerSnapshot) {
  return {
    draft: snapshot.draft,
    answers: snapshot.answers,
    skillShotResults: snapshot.skillShotResults?.map(({ slug, practice, checkInAnswer, completedAt }) => ({
      slug,
      practice,
      checkInAnswer,
      completedAt,
    })),
  };
}

function hasGuestProgress(snapshot: LearnerSnapshot): boolean {
  return Boolean(snapshot.answers || snapshot.skillShotResults?.length);
}

export type LearnerState = { snapshot: LearnerSnapshot; user: SessionUser | null };

export async function loadLearnerState(): Promise<LearnerState> {
  const user = await fetchSessionUser();
  if (!user) return { snapshot: loadLearnerSnapshot(), user: null };

  const local = loadLearnerSnapshot();
  if (hasGuestProgress(local)) {
    // Progress made on this device before signing in joins the account, then leaves the browser.
    const { snapshot } = await sendJson<{ snapshot: LearnerSnapshot }>("/api/learner/import", "POST", toImportable(local));
    clearLearnerSnapshot();
    return { snapshot, user };
  }

  const response = await fetch("/api/learner/state", { cache: "no-store" });
  if (!response.ok) throw new Error("Your profile could not be loaded. Please refresh.");
  const { snapshot } = (await response.json()) as { snapshot: LearnerSnapshot };
  return { snapshot, user };
}

export async function saveDraft(draft: LearnerDraft): Promise<void> {
  if (await fetchSessionUser()) {
    await sendJson("/api/learner/onboarding", "PUT", draft);
    return;
  }
  saveLearnerSnapshot({ draft });
}

export async function saveAssessment(answers: AssessmentAnswers): Promise<void> {
  if (await fetchSessionUser()) {
    await sendJson("/api/learner/assessment", "POST", { answers });
    return;
  }
  const snapshot = loadLearnerSnapshot();
  saveLearnerSnapshot({ ...snapshot, answers, scores: scoreAssessment(answers) });
}

export type SkillShotOutcome = { correct: boolean; evidenceAdded: boolean };

export async function completeSkillShot(slug: string, practice: string, checkInAnswer: number): Promise<SkillShotOutcome> {
  if (await fetchSessionUser()) {
    return sendJson<SkillShotOutcome>(`/api/skill-shots/${encodeURIComponent(slug)}/complete`, "POST", { practice, checkInAnswer });
  }

  const skillShot = getSkillShot(slug);
  const correct = skillShot?.checkIn.correctIndex === checkInAnswer;
  const snapshot = loadLearnerSnapshot();
  const completedAt = new Date().toISOString();
  const results = (snapshot.skillShotResults ?? []).filter((result) => result.slug !== slug || !correct);
  const next: LearnerSnapshot = {
    ...snapshot,
    skillShotResults: [...results, { slug, practice, checkInAnswer, completedAt }],
  };

  const evidenceAdded = Boolean(correct && skillShot && snapshot.scores && !snapshot.completedSkillShots?.includes(slug));
  if (evidenceAdded && skillShot && snapshot.scores) {
    next.scores = applyEvidence(snapshot.scores, skillShot.pillarId);
    next.completedSkillShots = [...(snapshot.completedSkillShots ?? []), slug];
    next.evidence = [...(snapshot.evidence ?? []), { skillShotSlug: slug, pillarId: skillShot.pillarId, scoreDelta: 10, createdAt: completedAt }];
  }

  saveLearnerSnapshot(next);
  return { correct, evidenceAdded };
}

export async function requestSignInLink(input: { email: string; name?: string; next?: string; includeGuestProgress: boolean }) {
  const local = loadLearnerSnapshot();
  return sendJson<{ message: string }>("/api/auth/magic-link", "POST", {
    email: input.email,
    name: input.name,
    next: input.next,
    snapshot: input.includeGuestProgress && hasGuestProgress(local) ? toImportable(local) : undefined,
  });
}

export async function verifySignInLink(token: string): Promise<string> {
  const { redirectPath, carriedProgress } = await sendJson<{ redirectPath: string; carriedProgress: boolean }>(
    "/api/auth/verify",
    "POST",
    { token },
  );
  // The server imported the snapshot that travelled with the link. Any other guest progress
  // in this browser merges on the next load.
  if (carriedProgress) clearLearnerSnapshot();
  return redirectPath;
}

export async function signOut(): Promise<void> {
  await fetch("/api/auth/session", { method: "DELETE" });
}
