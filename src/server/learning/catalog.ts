import "server-only";

import { and, eq, inArray, sql } from "drizzle-orm";

import { pillars, type PillarId } from "@/features/assessment/model";
import { skillShots as skillShotContent } from "@/features/journey/model";
import type { Database } from "@/server/db/client";
import { ensureDatabaseSchema } from "@/server/db/ensure-schema";
import { assessmentQuestions, assessments, skills, skillShots } from "@/server/db/schema";
import { seedDatabase } from "@/server/db/seed/seed-database";
import { seedSkills } from "@/server/db/seed/catalog";

import { baselineAssessmentTitle, baselineRubricVersion, pillarAnchorSkills } from "./snapshot";

export type LearningCatalog = {
  skillIdBySlug: Map<string, string>;
  skillShotIdBySlug: Map<string, string>;
  assessmentId: string;
  questionIdByPillar: Map<PillarId, string>;
};

// Fixed ids make every upsert idempotent, even if two processes start at once.
export const baselineAssessmentId = baselineRubricVersion;
const questionId = (sequence: number) => `${baselineRubricVersion}-q${sequence}`;

let catalogPromise: Promise<LearningCatalog> | undefined;

/**
 * Hostinger offers no shell for `npm run db:seed`, so the catalog rows that learner data
 * points to are created on first use. Every statement is an idempotent upsert.
 */
export function ensureLearningCatalog(database: Database): Promise<LearningCatalog> {
  catalogPromise ??= buildCatalog(database).catch((error: unknown) => {
    catalogPromise = undefined;
    throw error;
  });
  return catalogPromise;
}

async function loadSkillIds(database: Database): Promise<Map<string, string>> {
  const rows = await database
    .select({ id: skills.id, slug: skills.slug })
    .from(skills)
    .where(and(eq(skills.version, 1), inArray(skills.slug, seedSkills.map(({ slug }) => slug))));
  return new Map(rows.map(({ id, slug }) => [slug, id]));
}

async function buildCatalog(database: Database): Promise<LearningCatalog> {
  await ensureDatabaseSchema();
  let skillIdBySlug = await loadSkillIds(database);
  if (skillIdBySlug.size < seedSkills.length) {
    await seedDatabase(database);
    skillIdBySlug = await loadSkillIds(database);
  }

  // Earlier seeds gave every skill a random parent id that points nowhere; clear those once.
  await database.execute(
    sql`UPDATE skills AS child LEFT JOIN skills AS parent ON parent.id = child.parent_skill_id SET child.parent_skill_id = NULL WHERE child.parent_skill_id IS NOT NULL AND parent.id IS NULL`,
  );

  const anchorId = (pillarId: PillarId) => {
    const id = skillIdBySlug.get(pillarAnchorSkills[pillarId]);
    if (!id) throw new Error(`Anchor skill is missing for ${pillarId}.`);
    return id;
  };

  for (const skillShot of skillShotContent) {
    await database
      .insert(skillShots)
      .values({
        skillId: anchorId(skillShot.pillarId),
        title: skillShot.title,
        slug: skillShot.slug,
        learningObjective: skillShot.objective,
        format: "interactive",
        durationMinutes: skillShot.durationMinutes,
        content: skillShot,
        provenanceSummary: "FutureSkilz editorial seed, Release 1",
        status: "active",
        publishedAt: new Date(),
      })
      .onDuplicateKeyUpdate({
        set: {
          skillId: anchorId(skillShot.pillarId),
          title: skillShot.title,
          learningObjective: skillShot.objective,
          durationMinutes: skillShot.durationMinutes,
          content: skillShot,
          status: "active",
        },
      });
  }

  await database
    .insert(assessments)
    .values({ id: baselineAssessmentId, title: baselineAssessmentTitle, type: "baseline", rubricVersion: baselineRubricVersion, status: "active" })
    .onDuplicateKeyUpdate({ set: { title: baselineAssessmentTitle, status: "active" } });

  const questionIdByPillar = new Map<PillarId, string>();
  for (const [index, pillar] of pillars.entries()) {
    const id = questionId(index + 1);
    const rubric = { pillarId: pillar.id, options: pillar.options, scoring: "option index 0–3 maps to 25/50/75/100" };
    await database
      .insert(assessmentQuestions)
      .values({ id, assessmentId: baselineAssessmentId, skillId: anchorId(pillar.id), sequence: index + 1, prompt: pillar.question, responseType: "single-choice", rubric })
      .onDuplicateKeyUpdate({ set: { prompt: pillar.question, skillId: anchorId(pillar.id), rubric } });
    questionIdByPillar.set(pillar.id, id);
  }

  const shotRows = await database
    .select({ id: skillShots.id, slug: skillShots.slug })
    .from(skillShots)
    .where(inArray(skillShots.slug, skillShotContent.map(({ slug }) => slug)));

  return {
    skillIdBySlug,
    skillShotIdBySlug: new Map(shotRows.map(({ id, slug }) => [slug, id])),
    assessmentId: baselineAssessmentId,
    questionIdByPillar,
  };
}
