import "server-only";

import { and, desc, eq, gte, inArray } from "drizzle-orm";

import { detectFraud, lessonTrust, RULES, type FraudFlagDraft, type Severity } from "@/features/capture/earnings/fraud";
import { fraudFlags, kcFeedback, kcLearningEvents, kcLessonAttribution, kcLessons, kcReceipts } from "@/server/db/schema";

import { learnerRefFor } from "./learner-service";
import { CaptureError, audit, database, iso, rolesOf, type Executor } from "./shared";

async function requireAdmin(executor: Executor, userId: string): Promise<void> {
  if (!(await rolesOf(executor, userId)).has("admin")) throw new CaptureError(403, "Only an admin can review fraud flags.");
}

export type FlagRow = { id: string; subjectType: string; subjectRef: string; rule: string; ruleLabel: string; why: string; severity: Severity; summary: string; status: "open" | "confirmed" | "dismissed"; note: string | null; createdAt: string; reviewedAt: string | null };

const toRow = (row: typeof fraudFlags.$inferSelect): FlagRow => ({ id: row.id, subjectType: row.subjectType, subjectRef: row.subjectRef, rule: row.rule, ruleLabel: RULES[row.rule]?.label ?? row.rule, why: RULES[row.rule]?.why ?? "", severity: row.severity, summary: row.summary, status: row.status, note: row.note, createdAt: iso(row.createdAt), reviewedAt: row.reviewedAt ? iso(row.reviewedAt) : null });

/** Runs the rules over the last 60 days and records new flags. Existing ones (any status) are left as they are. */
export async function scanFraud(userId: string, days = 60): Promise<{ checked: { events: number; ratings: number }; created: number; open: number }> {
  const db = await database();
  await requireAdmin(db, userId);
  const since = new Date(Date.now() - days * 86_400_000);
  const lessonRows = await db.select().from(kcLessons).where(inArray(kcLessons.status, ["published", "retired"]));
  const ids = lessonRows.map((row) => row.id);
  const attribution = ids.length ? await db.select().from(kcLessonAttribution).where(inArray(kcLessonAttribution.lessonId, ids)) : [];
  const eventRows = ids.length ? await db.select().from(kcLearningEvents).where(and(inArray(kcLearningEvents.lessonId, ids), gte(kcLearningEvents.occurredAt, since))) : [];
  const ratingRows = ids.length ? await db.select().from(kcFeedback).where(and(inArray(kcFeedback.lessonId, ids), gte(kcFeedback.updatedAt, since))) : [];
  const receiptRows = await db.select().from(kcReceipts).where(gte(kcReceipts.receivedAt, since));
  const drafts = detectFraud({
    events: eventRows.map((row) => ({ lessonId: row.lessonId, learnerRef: row.learnerRef, type: row.eventType, seconds: row.seconds, occurredAt: iso(row.occurredAt) })),
    ratings: ratingRows.map((row) => ({ lessonId: row.lessonId, learnerRef: row.learnerRef, rating: row.rating, occurredAt: iso(row.updatedAt) })),
    lessons: lessonRows.map((row) => ({ id: row.id, durationSeconds: row.durationSeconds, authorLearnerRefs: attribution.filter((a) => a.lessonId === row.id).map((a) => learnerRefFor({ userId: a.contributorId })).filter((ref): ref is string => Boolean(ref)) })),
    receipts: receiptRows.filter((row) => !row.externalRef.startsWith("demo-")).map((row) => ({ externalRef: row.externalRef, grossMinor: row.grossMinor, refundMinor: row.refundMinor, receivedAt: iso(row.receivedAt) })),
  });
  let created = 0;
  for (const draft of drafts) created += (await insertFlag(db, draft)) ? 1 : 0;
  const open = await db.select({ id: fraudFlags.id }).from(fraudFlags).where(eq(fraudFlags.status, "open"));
  await audit(db, userId, "fraud.scan", "fraud_flag", null, { created, events: eventRows.length });
  return { checked: { events: eventRows.length, ratings: ratingRows.length }, created, open: open.length };
}

async function insertFlag(db: Executor, draft: FraudFlagDraft): Promise<boolean> {
  const [existing] = await db.select({ id: fraudFlags.id }).from(fraudFlags).where(and(eq(fraudFlags.subjectType, draft.subjectType), eq(fraudFlags.subjectRef, draft.subjectRef), eq(fraudFlags.rule, draft.rule), eq(fraudFlags.windowKey, draft.windowKey))).limit(1);
  if (existing) return false;
  await db.insert(fraudFlags).values({ subjectType: draft.subjectType, subjectRef: draft.subjectRef, rule: draft.rule, severity: draft.severity, windowKey: draft.windowKey, summary: draft.summary.slice(0, 240), details: draft.details });
  return true;
}

export async function listFlags(userId: string, status: "open" | "confirmed" | "dismissed" | "all" = "open"): Promise<FlagRow[]> {
  const db = await database();
  await requireAdmin(db, userId);
  const rows = await db.select().from(fraudFlags).where(status === "all" ? undefined : eq(fraudFlags.status, status)).orderBy(desc(fraudFlags.createdAt)).limit(200);
  return rows.map(toRow);
}

export async function reviewFlag(userId: string, id: string, action: "confirm" | "dismiss", note: string): Promise<FlagRow> {
  const db = await database();
  await requireAdmin(db, userId);
  const [row] = await db.select().from(fraudFlags).where(eq(fraudFlags.id, id)).limit(1);
  if (!row) throw new CaptureError(404, "That flag was not found.");
  if (row.status !== "open") throw new CaptureError(409, "This flag was already reviewed.");
  const clean = note.trim().slice(0, 1000);
  if (clean.length < 5) throw new CaptureError(400, "Write a short note saying why, so the decision can be understood later.");
  await db.update(fraudFlags).set({ status: action === "confirm" ? "confirmed" : "dismissed", reviewedBy: userId, reviewedAt: new Date(), note: clean }).where(eq(fraudFlags.id, id));
  await audit(db, userId, `fraud.${action}`, "fraud_flag", id, { rule: row.rule });
  const [fresh] = await db.select().from(fraudFlags).where(eq(fraudFlags.id, id));
  return toRow(fresh);
}

/** What allocations need from fraud review: learners to leave out, and a trust factor per lesson. */
export async function fraudInputs(db: Executor, lessonIds: string[]): Promise<{ excludedLearners: string[]; trust: Map<string, number>; openCount: number }> {
  const rows = await db.select().from(fraudFlags).where(inArray(fraudFlags.status, ["open", "confirmed"]));
  const excludedLearners = rows.filter((row) => row.status === "confirmed" && row.subjectType === "learner").map((row) => row.subjectRef);
  const trust = new Map<string, number>();
  for (const id of lessonIds) trust.set(id, lessonTrust(rows.filter((row) => row.subjectType === "lesson" && row.subjectRef === id).map((row) => ({ status: row.status as "open" | "confirmed", severity: row.severity }))));
  return { excludedLearners, trust, openCount: rows.filter((row) => row.status === "open").length };
}
