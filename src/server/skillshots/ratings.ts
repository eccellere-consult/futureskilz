import "server-only";

import { and, eq, inArray, sql } from "drizzle-orm";

import { getDesignedSkillShot } from "@/features/skillshot";
import { summariseRatings, type RatingSummary } from "@/features/skillshot/rating";
import { learnerRefFor } from "@/server/capture/learner-service";
import { CaptureError, database, newUuid } from "@/server/capture/shared";
import { skillShotDrafts, skillShotRatings } from "@/server/db/schema";

/**
 * Star ratings for Skill Shots. A learner gives 1 to 5 stars and may add a comment; rating again replaces the earlier one.
 * A rating says how useful the learner found the lesson. It is one signal for the editor, not proof that anyone learned.
 */
type Identity = { userId?: string | null; anonymousKey?: string | null };

const SLUG = /^[a-z0-9-]{3,80}$/;

/** A Skill Shot a learner can open: built into the product, or made in the studio and approved or published. */
async function requireRateable(slug: string): Promise<void> {
  if (!SLUG.test(slug)) throw new CaptureError(404, "That Skill Shot is not available.");
  if (getDesignedSkillShot(slug)) return;
  const db = await database();
  const [row] = await db.select({ status: skillShotDrafts.status }).from(skillShotDrafts).where(eq(skillShotDrafts.slug, slug)).limit(1);
  if (!row || (row.status !== "published" && row.status !== "approved")) throw new CaptureError(404, "That Skill Shot is not available.");
}

export async function rateSkillShot(input: { slug: string; rating: number; comment?: string; identity: Identity }): Promise<{ saved: true; summary: RatingSummary }> {
  const learnerRef = learnerRefFor(input.identity);
  if (!learnerRef) throw new CaptureError(400, "A learner key is needed to save a rating.");
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) throw new CaptureError(400, "Choose 1 to 5 stars.");
  await requireRateable(input.slug);
  const comment = input.comment?.trim().slice(0, 600) || null;
  const db = await database();
  await db
    .insert(skillShotRatings)
    .values({ id: newUuid(), slug: input.slug, learnerRef, rating: input.rating, comment })
    // A new star without a comment keeps the comment given before.
    .onDuplicateKeyUpdate({ set: comment ? { rating: input.rating, comment } : { rating: input.rating } });
  return { saved: true, summary: await ratingSummary(input.slug) };
}

export async function myRating(slug: string, identity: Identity): Promise<number | null> {
  const learnerRef = learnerRefFor(identity);
  if (!learnerRef || !SLUG.test(slug)) return null;
  const db = await database();
  const [row] = await db.select({ rating: skillShotRatings.rating }).from(skillShotRatings).where(and(eq(skillShotRatings.slug, slug), eq(skillShotRatings.learnerRef, learnerRef))).limit(1);
  return row?.rating ?? null;
}

/** The average and the number of ratings for each of the given Skill Shots. One with no ratings is simply absent. */
export async function ratingSummaries(slugs: string[]): Promise<Map<string, RatingSummary>> {
  const wanted = [...new Set(slugs.filter((slug) => SLUG.test(slug)))];
  if (!wanted.length) return new Map();
  const db = await database();
  const rows = await db
    .select({ slug: skillShotRatings.slug, count: sql<number>`count(*)`, total: sql<number>`coalesce(sum(${skillShotRatings.rating}), 0)` })
    .from(skillShotRatings)
    .where(inArray(skillShotRatings.slug, wanted))
    .groupBy(skillShotRatings.slug);
  return new Map(rows.map((row) => [row.slug, summariseRatings(Number(row.count), Number(row.total))]));
}

export async function ratingSummary(slug: string): Promise<RatingSummary> {
  return (await ratingSummaries([slug])).get(slug) ?? summariseRatings(0, 0);
}
