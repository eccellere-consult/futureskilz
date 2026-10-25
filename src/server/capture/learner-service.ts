import "server-only";

import { createHmac, createHash } from "node:crypto";

import { and, eq, inArray, ne, sql } from "drizzle-orm";

import { kcFeedback, kcLearningEvents, kcLessons } from "@/server/db/schema";
import { getServerEnvironment } from "@/server/env";

import { CaptureError, database } from "./shared";

/**
 * Learner activity, recorded from the first view. A learner is stored only as a keyed hash, never an email or name; every
 * event is append-only and idempotent so retries and double taps cannot inflate usage. Nothing here decides earnings:
 * it records history that a business-approved, versioned policy is applied to later.
 */

const EVENT_TYPES = ["start", "progress", "complete", "material_use", "check_result", "return"] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export function learnerRefFor(identity: { userId?: string | null; anonymousKey?: string | null }): string | null {
  const secret = getServerEnvironment().SESSION_SECRET ?? "futureskilz-development-learner-key";
  const id = identity.userId ? `user:${identity.userId}` : identity.anonymousKey && /^[A-Za-z0-9-]{16,64}$/.test(identity.anonymousKey) ? `anon:${identity.anonymousKey}` : null;
  return id ? createHmac("sha256", secret).update(id).digest("hex").slice(0, 40) : null;
}

export type EventInput = { slug: string; type: string; seconds?: number; value?: number; eventKey?: string; identity: { userId?: string | null; anonymousKey?: string | null } };

export async function recordEvent(input: EventInput): Promise<{ recorded: true }> {
  if (!(EVENT_TYPES as readonly string[]).includes(input.type)) throw new CaptureError(400, "Unknown event.");
  const learnerRef = learnerRefFor(input.identity);
  if (!learnerRef) throw new CaptureError(400, "A learner key is needed to record progress.");
  const db = await database();
  const [lesson] = await db.select().from(kcLessons).where(and(eq(kcLessons.slug, input.slug), eq(kcLessons.status, "published")));
  if (!lesson) throw new CaptureError(404, "That lesson is not available.");

  const type = input.type as EventType;
  const today = new Date().toISOString().slice(0, 10);
  // One completion per learner and lesson version; one start and one return per day; the rest carry the client's own key.
  const key = type === "complete" ? "complete" : type === "start" || type === "return" ? today : (input.eventKey ?? "").slice(0, 64);
  if (!key) throw new CaptureError(400, "This event needs an event key.");
  const seconds = type === "progress" ? Math.max(0, Math.min(300, Math.round(input.seconds ?? 0))) : 0;
  const dedupeKey = createHash("sha256").update(`${learnerRef}|${lesson.id}|${lesson.version}|${type}|${key}`).digest("hex");
  await db
    .insert(kcLearningEvents)
    .values({ lessonId: lesson.id, lessonVersion: lesson.version, learnerRef, eventType: type, seconds, value: typeof input.value === "number" ? Math.round(input.value) : null, dedupeKey })
    .onDuplicateKeyUpdate({ set: { dedupeKey } });
  return { recorded: true };
}

export type FeedbackInput = { slug: string; rating: number; useful?: boolean; comment?: string; identity: EventInput["identity"] };

export async function recordFeedback(input: FeedbackInput): Promise<{ saved: true; held: boolean }> {
  const learnerRef = learnerRefFor(input.identity);
  if (!learnerRef) throw new CaptureError(400, "A learner key is needed to save feedback.");
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) throw new CaptureError(400, "Choose a rating from 1 to 5.");
  const db = await database();
  const [lesson] = await db.select().from(kcLessons).where(and(eq(kcLessons.slug, input.slug), eq(kcLessons.status, "published")));
  if (!lesson) throw new CaptureError(404, "That lesson is not available.");
  const comment = input.comment?.trim().slice(0, 600) || null;
  // Comments with links are held for a moderator; the rating still counts.
  const held = !!comment && /https?:\/\/|www\./i.test(comment);
  await db
    .insert(kcFeedback)
    .values({ lessonId: lesson.id, lessonVersion: lesson.version, learnerRef, rating: input.rating, useful: input.useful ?? null, comment, moderation: held ? "held" : "visible" })
    .onDuplicateKeyUpdate({ set: { rating: input.rating, useful: input.useful ?? null, comment, lessonVersion: lesson.version, moderation: held ? "held" : "visible" } });
  return { saved: true, held };
}

export async function myFeedback(slug: string, identity: EventInput["identity"]): Promise<{ rating: number; useful: boolean | null } | null> {
  const learnerRef = learnerRefFor(identity);
  if (!learnerRef) return null;
  const db = await database();
  const [lesson] = await db.select().from(kcLessons).where(eq(kcLessons.slug, slug));
  if (!lesson) return null;
  const [row] = await db.select().from(kcFeedback).where(and(eq(kcFeedback.lessonId, lesson.id), eq(kcFeedback.learnerRef, learnerRef)));
  return row ? { rating: row.rating, useful: row.useful } : null;
}

export async function usageByLesson(lessonIds: string[]) {
  if (lessonIds.length === 0) return new Map<string, { starts: number; learners: number; completions: number; seconds: number; materialUses: number; ratings: number; meanRating: number | null }>();
  const db = await database();
  const events = await db
    .select({
      lessonId: kcLearningEvents.lessonId,
      type: kcLearningEvents.eventType,
      n: sql<number>`count(*)`,
      learners: sql<number>`count(distinct ${kcLearningEvents.learnerRef})`,
      seconds: sql<number>`coalesce(sum(${kcLearningEvents.seconds}), 0)`,
    })
    .from(kcLearningEvents)
    .where(inArray(kcLearningEvents.lessonId, lessonIds))
    .groupBy(kcLearningEvents.lessonId, kcLearningEvents.eventType);
  const learners = await db
    .select({ lessonId: kcLearningEvents.lessonId, learners: sql<number>`count(distinct ${kcLearningEvents.learnerRef})` })
    .from(kcLearningEvents)
    .where(inArray(kcLearningEvents.lessonId, lessonIds))
    .groupBy(kcLearningEvents.lessonId);
  const ratings = await db
    .select({ lessonId: kcFeedback.lessonId, n: sql<number>`count(*)`, mean: sql<number>`avg(${kcFeedback.rating})` })
    .from(kcFeedback)
    .where(and(inArray(kcFeedback.lessonId, lessonIds), ne(kcFeedback.moderation, "removed")))
    .groupBy(kcFeedback.lessonId);
  const out = new Map<string, { starts: number; learners: number; completions: number; seconds: number; materialUses: number; ratings: number; meanRating: number | null }>();
  for (const id of lessonIds) out.set(id, { starts: 0, learners: 0, completions: 0, seconds: 0, materialUses: 0, ratings: 0, meanRating: null });
  for (const row of events) {
    const usage = out.get(row.lessonId)!;
    if (row.type === "start") usage.starts = Number(row.n);
    if (row.type === "complete") usage.completions = Number(row.n);
    if (row.type === "progress") usage.seconds = Number(row.seconds);
    if (row.type === "material_use") usage.materialUses = Number(row.n);
  }
  for (const row of learners) out.get(row.lessonId)!.learners = Number(row.learners);
  for (const row of ratings) {
    const usage = out.get(row.lessonId)!;
    usage.ratings = Number(row.n);
    usage.meanRating = Number(Number(row.mean).toFixed(2));
  }
  return out;
}

/** Different people across all of a contributor's lessons (not the per-lesson counts added together). */
export async function distinctLearners(lessonIds: string[]): Promise<number> {
  if (lessonIds.length === 0) return 0;
  const db = await database();
  const [row] = await db.select({ n: sql<number>`count(distinct ${kcLearningEvents.learnerRef})` }).from(kcLearningEvents).where(inArray(kcLearningEvents.lessonId, lessonIds));
  return Number(row?.n ?? 0);
}
