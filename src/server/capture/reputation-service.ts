import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import { coachReputation, type Reputation } from "@/features/capture/earnings/reputation";
import { fraudFlags, kcContributors, kcLessonAttribution, kcLessons } from "@/server/db/schema";

import { usageByLesson, distinctLearners } from "./learner-service";
import { database, type Executor } from "./shared";

/** A coach's reputation from what learners did, what reviewers did and what fraud review found. Computed on request, never stored. */
export async function reputationFor(userId: string, executor?: Executor): Promise<Reputation> {
  const db = executor ?? (await database());
  const credited = await db.select({ lessonId: kcLessonAttribution.lessonId }).from(kcLessonAttribution).where(eq(kcLessonAttribution.contributorId, userId));
  const lessonRows = credited.length ? await db.select().from(kcLessons).where(inArray(kcLessons.id, credited.map((row) => row.lessonId))) : [];
  const published = lessonRows.filter((row) => row.status === "published");
  const reviewed = lessonRows.filter((row) => ["published", "retired", "approved"].includes(row.status));
  const ids = published.map((row) => row.id);
  const usage = ids.length ? await usageByLesson(ids) : new Map();
  let starts = 0, completions = 0, ratings = 0, ratingSum = 0;
  for (const id of ids) {
    const u = usage.get(id);
    if (!u) continue;
    starts += u.starts; completions += u.completions; ratings += u.ratings; ratingSum += (u.meanRating ?? 0) * u.ratings;
  }
  const [coach] = await db.select().from(kcContributors).where(eq(kcContributors.userId, userId)).limit(1);
  const flags = ids.length ? await db.select().from(fraudFlags).where(and(eq(fraudFlags.subjectType, "lesson"), inArray(fraudFlags.subjectRef, ids))) : [];
  return coachReputation({
    lessonsPublished: published.length,
    learners: ids.length ? await distinctLearners(ids) : 0,
    starts, completions, ratings, meanRating: ratings ? ratingSum / ratings : null,
    contentQuality: reviewed.length ? published.length / reviewed.length : null,
    tenureDays: coach ? Math.max(0, (Date.now() - coach.createdAt.getTime()) / 86_400_000) : 0,
    flagsConfirmed: flags.filter((f) => f.status === "confirmed").length,
    flagsOpen: flags.filter((f) => f.status === "open").length,
  });
}
