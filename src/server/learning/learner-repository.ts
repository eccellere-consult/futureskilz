import "server-only";

import { and, desc, eq, gt, inArray } from "drizzle-orm";

import { scoreAssessment, type AssessmentAnswers, type PillarId } from "@/features/assessment/model";
import { getSkillShot } from "@/features/journey/model";
import type { LearnerDraft } from "@/features/learner/draft";
import type { ImportableSnapshot } from "@/features/learner/snapshot-schema";
import { greetingName } from "@/server/auth/magic-link";
import type { Database } from "@/server/db/client";
import {
  assessmentAttempts,
  assessmentResponses,
  goals,
  goalSkills,
  learnerProfiles,
  learnerSkills,
  practiceSessions,
  skillEvidence,
  skillShotAttempts,
  users,
} from "@/server/db/schema";

import { ensureLearningCatalog, type LearningCatalog } from "./catalog";
import {
  baselineConfidence,
  checkInConfidenceGain,
  checkInEvidenceType,
  checkInLevelGain,
  hasCompleteAnswers,
  isCorrectCheckIn,
  levelFromScore,
  pillarAnchorSkills,
  projectSnapshot,
  skillShotEvidenceSource,
  designedEvidenceSource,
  designedEvidenceType,
  verifySkillShotResults,
  type StoredLearnerState,
} from "./snapshot";

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type Executor = Database | Transaction;

const prioritySkillTargetLevel = 4;

export class LearnerRepository {
  constructor(private readonly database: Database) {}

  private catalog(): Promise<LearningCatalog> {
    return ensureLearningCatalog(this.database);
  }

  async hasLearningData(userId: string, executor: Executor = this.database): Promise<boolean> {
    const [attempt] = await executor
      .select({ id: assessmentAttempts.id })
      .from(assessmentAttempts)
      .where(eq(assessmentAttempts.learnerId, userId))
      .limit(1);
    return Boolean(attempt);
  }

  /** Moves a guest snapshot into the account. Existing account data always wins; new Skill Shots merge in. */
  async importSnapshot(userId: string, snapshot: ImportableSnapshot): Promise<{ imported: boolean }> {
    const catalog = await this.catalog();

    return this.database.transaction(async (transaction) => {
      const hasData = await this.hasLearningData(userId, transaction);
      let imported = false;

      if (!hasData && hasCompleteAnswers(snapshot.answers)) {
        await this.writeDraft(transaction, catalog, userId, snapshot.draft);
        await this.writeAssessment(transaction, catalog, userId, snapshot.answers as AssessmentAnswers);
        imported = true;
      }

      if (await this.hasLearningData(userId, transaction)) {
        const attempted = await transaction
          .select({ skillShotId: skillShotAttempts.skillShotId })
          .from(skillShotAttempts)
          .where(eq(skillShotAttempts.learnerId, userId));
        const attemptedIds = new Set(attempted.map(({ skillShotId }) => skillShotId));
        for (const result of verifySkillShotResults(snapshot.skillShotResults)) {
          if (attemptedIds.has(catalog.skillShotIdBySlug.get(result.slug) ?? "")) continue;
          const outcome = await this.writeSkillShotResult(transaction, catalog, userId, result.slug, result.practice, result.checkInAnswer);
          imported ||= outcome.evidenceAdded;
        }
      }

      return { imported };
    });
  }

  async saveDraft(userId: string, draft: LearnerDraft): Promise<void> {
    const catalog = await this.catalog();
    await this.database.transaction((transaction) => this.writeDraft(transaction, catalog, userId, draft));
  }

  async saveAssessment(userId: string, answers: AssessmentAnswers): Promise<void> {
    const catalog = await this.catalog();
    await this.database.transaction((transaction) => this.writeAssessment(transaction, catalog, userId, answers));
  }

  async completeSkillShot(userId: string, slug: string, practice: string, checkInAnswer: number) {
    const catalog = await this.catalog();
    return this.database.transaction((transaction) =>
      this.writeSkillShotResult(transaction, catalog, userId, slug, practice, checkInAnswer),
    );
  }

  /** Records a passed designed Skill Shot: one piece of evidence per skill it builds, once, never above what the lesson teaches. */
  async completeDesignedSkillShot(userId: string, id: string, skills: Array<{ skill: string; toLevel: number }>): Promise<{ evidenceAdded: boolean; skills: string[] }> {
    const catalog = await this.catalog();
    return this.database.transaction(async (transaction) => {
      const added: string[] = [];
      const now = new Date();
      for (const { skill, toLevel } of skills) {
        const skillId = catalog.skillIdBySlug.get(skill);
        if (!skillId) continue;
        const source = designedEvidenceSource(id, skill);
        const [existing] = await transaction.select({ id: skillEvidence.id }).from(skillEvidence).where(and(eq(skillEvidence.learnerId, userId), eq(skillEvidence.source, source))).limit(1);
        if (existing) continue;
        await transaction.insert(skillEvidence).values({ learnerId: userId, skillId, evidenceType: designedEvidenceType, score: 1, source, evaluator: "rule:designed-check-v1", confidence: 0.5 });
        const [current] = await transaction
          .select({ currentLevel: learnerSkills.currentLevel, confidence: learnerSkills.confidence, evidenceCount: learnerSkills.evidenceCount })
          .from(learnerSkills)
          .where(and(eq(learnerSkills.learnerId, userId), eq(learnerSkills.skillId, skillId)))
          .limit(1);
        const level = current?.currentLevel ?? 0;
        const values = {
          currentLevel: Math.max(level, Math.min(toLevel, level + checkInLevelGain)),
          confidence: Math.min(1, (current?.confidence ?? baselineConfidence) + checkInConfidenceGain),
          evidenceCount: (current?.evidenceCount ?? 0) + 1,
          lastAssessedAt: now,
        };
        await transaction.insert(learnerSkills).values({ learnerId: userId, skillId, targetLevel: prioritySkillTargetLevel, ...values }).onDuplicateKeyUpdate({ set: values });
        added.push(skill);
      }
      return { evidenceAdded: added.length > 0, skills: added };
    });
  }

  async saveWelcomeSummary(userId: string, summary: string, source: "ai" | "template"): Promise<void> {
    await this.database
      .insert(learnerProfiles)
      .values({ userId, welcomeSummary: summary, welcomeSummarySource: source })
      .onDuplicateKeyUpdate({ set: { welcomeSummary: summary, welcomeSummarySource: source } });
  }

  private async writeDraft(executor: Executor, catalog: LearningCatalog, userId: string, draft: LearnerDraft) {
    const name = greetingName(draft.name);
    if (name) await executor.update(users).set({ displayName: name }).where(eq(users.id, userId));

    const profile = {
      currentRole: draft.currentRole || null,
      responsibilityLevel: draft.responsibilityLevel || null,
      focus: draft.focus || null,
      horizon: draft.horizon || null,
      challengeType: draft.challengeType || null,
      challenge: draft.challenge || null,
      priorityFamilies: draft.priorityFamilies,
      weeklyMinutes: draft.weeklyMinutes || null,
    };
    await executor
      .insert(learnerProfiles)
      .values({ userId, ...profile })
      .onDuplicateKeyUpdate({ set: profile });

    if (!draft.goal) return;

    const [activeGoal] = await executor
      .select({ id: goals.id })
      .from(goals)
      .where(and(eq(goals.learnerId, userId), eq(goals.status, "active")))
      .orderBy(desc(goals.createdAt))
      .limit(1);

    let goalId = activeGoal?.id;
    if (goalId) {
      await executor.update(goals).set({ title: draft.goal.slice(0, 200), description: draft.challenge }).where(eq(goals.id, goalId));
    } else {
      goalId = crypto.randomUUID();
      await executor.insert(goals).values({ id: goalId, learnerId: userId, title: draft.goal.slice(0, 200), description: draft.challenge, status: "active" });
    }

    await executor.delete(goalSkills).where(eq(goalSkills.goalId, goalId));
    const goalSkillRows = draft.prioritySkills.flatMap((slug, index) => {
      const skillId = catalog.skillIdBySlug.get(slug);
      return skillId ? [{ goalId, skillId, targetLevel: prioritySkillTargetLevel, priority: index + 1 }] : [];
    });
    if (goalSkillRows.length > 0) await executor.insert(goalSkills).values(goalSkillRows);
  }

  private async writeAssessment(executor: Executor, catalog: LearningCatalog, userId: string, answers: AssessmentAnswers) {
    const scores = scoreAssessment(answers);
    const attemptId = crypto.randomUUID();
    const now = new Date();
    const averageScore = scores.reduce((total, pillar) => total + pillar.score, 0) / scores.length;

    await executor.insert(assessmentAttempts).values({
      id: attemptId,
      assessmentId: catalog.assessmentId,
      learnerId: userId,
      status: "evaluated",
      score: levelFromScore(averageScore),
      confidence: baselineConfidence,
      completedAt: now,
    });

    for (const pillar of scores) {
      const questionId = catalog.questionIdByPillar.get(pillar.id);
      const skillId = catalog.skillIdBySlug.get(pillarAnchorSkills[pillar.id]);
      if (!questionId || !skillId) throw new Error(`Baseline catalog is missing ${pillar.id}.`);

      await executor.insert(assessmentResponses).values({
        attemptId,
        questionId,
        response: { optionIndex: answers[pillar.id] ?? null },
        score: levelFromScore(pillar.score),
        evaluator: "self-report",
        confidence: baselineConfidence,
      });

      // A retaken baseline keeps the gains already earned through check-in evidence.
      const earned = await executor
        .select({ id: skillEvidence.id })
        .from(skillEvidence)
        .where(and(eq(skillEvidence.learnerId, userId), eq(skillEvidence.skillId, skillId), inArray(skillEvidence.evidenceType, [checkInEvidenceType, designedEvidenceType])));
      const level = Math.min(5, levelFromScore(pillar.score) + earned.length * checkInLevelGain);
      const confidence = Math.min(1, baselineConfidence + earned.length * checkInConfidenceGain);
      const values = { currentLevel: level, confidence, evidenceCount: earned.length, lastAssessedAt: now };

      await executor
        .insert(learnerSkills)
        .values({ learnerId: userId, skillId, targetLevel: prioritySkillTargetLevel, ...values })
        .onDuplicateKeyUpdate({ set: values });
    }
  }

  private async writeSkillShotResult(
    executor: Executor,
    catalog: LearningCatalog,
    userId: string,
    slug: string,
    practice: string,
    checkInAnswer: number,
  ): Promise<{ correct: boolean; evidenceAdded: boolean }> {
    const skillShot = getSkillShot(slug);
    const skillShotId = catalog.skillShotIdBySlug.get(slug);
    if (!skillShot || !skillShotId) throw new Error(`Unknown Skill Shot: ${slug}`);

    const skillId = catalog.skillIdBySlug.get(pillarAnchorSkills[skillShot.pillarId]);
    if (!skillId) throw new Error(`Anchor skill is missing for ${skillShot.pillarId}.`);

    const correct = isCorrectCheckIn(slug, checkInAnswer);
    const now = new Date();

    await executor.insert(skillShotAttempts).values({
      skillShotId,
      learnerId: userId,
      status: "evaluated",
      progress: 1,
      completedAt: now,
    });
    if (practice.trim()) {
      await executor.insert(practiceSessions).values({
        learnerId: userId,
        skillId,
        skillShotId,
        response: { practice: practice.trim(), checkInAnswer },
        feedback: { correct },
        score: correct ? 1 : 0,
      });
    }

    if (!correct) return { correct, evidenceAdded: false };

    const [existing] = await executor
      .select({ id: skillEvidence.id })
      .from(skillEvidence)
      .where(and(eq(skillEvidence.learnerId, userId), eq(skillEvidence.source, skillShotEvidenceSource(slug))))
      .limit(1);
    if (existing) return { correct, evidenceAdded: false };

    await executor.insert(skillEvidence).values({
      learnerId: userId,
      skillId,
      evidenceType: checkInEvidenceType,
      score: 1,
      source: skillShotEvidenceSource(slug),
      evaluator: "rule:check-in-v1",
      confidence: 0.6,
    });

    const [current] = await executor
      .select({ currentLevel: learnerSkills.currentLevel, confidence: learnerSkills.confidence, evidenceCount: learnerSkills.evidenceCount })
      .from(learnerSkills)
      .where(and(eq(learnerSkills.learnerId, userId), eq(learnerSkills.skillId, skillId)))
      .limit(1);
    const values = {
      currentLevel: Math.min(5, (current?.currentLevel ?? 0) + checkInLevelGain),
      confidence: Math.min(1, (current?.confidence ?? baselineConfidence) + checkInConfidenceGain),
      evidenceCount: (current?.evidenceCount ?? 0) + 1,
      lastAssessedAt: now,
    };
    await executor
      .insert(learnerSkills)
      .values({ learnerId: userId, skillId, targetLevel: prioritySkillTargetLevel, ...values })
      .onDuplicateKeyUpdate({ set: values });

    return { correct, evidenceAdded: true };
  }

  async loadState(userId: string): Promise<StoredLearnerState> {
    const catalog = await this.catalog();
    const [user] = await this.database.select({ displayName: users.displayName }).from(users).where(eq(users.id, userId)).limit(1);
    const [profile] = await this.database.select().from(learnerProfiles).where(eq(learnerProfiles.userId, userId)).limit(1);
    const [goal] = await this.database
      .select({ id: goals.id, title: goals.title })
      .from(goals)
      .where(and(eq(goals.learnerId, userId), eq(goals.status, "active")))
      .orderBy(desc(goals.createdAt))
      .limit(1);

    const slugBySkillId = new Map([...catalog.skillIdBySlug].map(([slug, id]) => [id, slug]));
    const goalSkillRows = goal
      ? await this.database.select({ skillId: goalSkills.skillId }).from(goalSkills).where(eq(goalSkills.goalId, goal.id)).orderBy(goalSkills.priority)
      : [];

    const [attempt] = await this.database
      .select({ id: assessmentAttempts.id })
      .from(assessmentAttempts)
      .where(and(eq(assessmentAttempts.learnerId, userId), eq(assessmentAttempts.assessmentId, catalog.assessmentId)))
      .orderBy(desc(assessmentAttempts.startedAt))
      .limit(1);
    const answers: Partial<Record<PillarId, number>> = {};
    if (attempt) {
      const pillarByQuestion = new Map([...catalog.questionIdByPillar].map(([pillarId, id]) => [id, pillarId]));
      const responses = await this.database
        .select({ questionId: assessmentResponses.questionId, response: assessmentResponses.response })
        .from(assessmentResponses)
        .where(eq(assessmentResponses.attemptId, attempt.id));
      for (const { questionId, response } of responses) {
        const pillarId = pillarByQuestion.get(questionId);
        const optionIndex = response.optionIndex;
        if (pillarId && typeof optionIndex === "number") answers[pillarId] = optionIndex;
      }
    }

    const anchorIds = Object.values(pillarAnchorSkills).flatMap((slug) => catalog.skillIdBySlug.get(slug) ?? []);
    const levelRows = anchorIds.length
      ? await this.database
          .select({ skillId: learnerSkills.skillId, currentLevel: learnerSkills.currentLevel })
          .from(learnerSkills)
          .where(and(eq(learnerSkills.learnerId, userId), inArray(learnerSkills.skillId, anchorIds)))
      : [];

    const evidenceRows = await this.database
      .select({ source: skillEvidence.source, createdAt: skillEvidence.createdAt })
      .from(skillEvidence)
      .where(and(eq(skillEvidence.learnerId, userId), eq(skillEvidence.evidenceType, checkInEvidenceType)))
      .orderBy(skillEvidence.createdAt);

    const slugBySkillShotId = new Map([...catalog.skillShotIdBySlug].map(([slug, id]) => [id, slug]));
    const practiceRows = await this.database
      .select({ skillShotId: practiceSessions.skillShotId, response: practiceSessions.response, createdAt: practiceSessions.createdAt })
      .from(practiceSessions)
      .where(eq(practiceSessions.learnerId, userId))
      .orderBy(practiceSessions.createdAt);

    const heldRows = await this.database
      .select({ skillId: learnerSkills.skillId, currentLevel: learnerSkills.currentLevel, confidence: learnerSkills.confidence, evidenceCount: learnerSkills.evidenceCount })
      .from(learnerSkills)
      .where(and(eq(learnerSkills.learnerId, userId), gt(learnerSkills.evidenceCount, 0)));
    const designedRows = await this.database
      .select({ source: skillEvidence.source })
      .from(skillEvidence)
      .where(and(eq(skillEvidence.learnerId, userId), eq(skillEvidence.evidenceType, designedEvidenceType)));

    return {
      skillLevels: heldRows.flatMap(({ skillId, currentLevel, confidence, evidenceCount }) => {
        const skill = slugBySkillId.get(skillId);
        return skill ? [{ skill, level: currentLevel, confidence, evidenceCount }] : [];
      }),
      designedEvidenceSources: designedRows.map(({ source }) => source),
      displayName: user?.displayName ?? "",
      profile: profile ?? null,
      goal: goal
        ? { title: goal.title, skillSlugs: goalSkillRows.flatMap(({ skillId }) => slugBySkillId.get(skillId) ?? []) }
        : null,
      answers,
      anchorLevels: new Map(levelRows.flatMap(({ skillId, currentLevel }) => {
        const slug = slugBySkillId.get(skillId);
        return slug ? [[slug, currentLevel] as const] : [];
      })),
      results: practiceRows.flatMap(({ skillShotId, response, createdAt }) => {
        const slug = skillShotId ? slugBySkillShotId.get(skillShotId) : undefined;
        if (!slug || typeof response.practice !== "string" || typeof response.checkInAnswer !== "number") return [];
        return [{ slug, practice: response.practice, checkInAnswer: response.checkInAnswer, completedAt: createdAt }];
      }),
      evidence: evidenceRows.flatMap(({ source, createdAt }) => {
        const slug = source.startsWith("skill-shot:") ? source.slice("skill-shot:".length) : null;
        return slug ? [{ slug, createdAt }] : [];
      }),
    };
  }

  async loadSnapshot(userId: string) {
    return projectSnapshot(await this.loadState(userId));
  }
}
