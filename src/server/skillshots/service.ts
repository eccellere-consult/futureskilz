import "server-only";

import { and, desc, eq, lt } from "drizzle-orm";
import type { z } from "zod";

import { reviewBlueprint, type Review } from "@/features/skillshot/rubric";
import { governanceFor, type Governance } from "@/features/marketplace/governance";
import { lessonBrief } from "@/features/skillshot/from-lesson";
import { LEGACY_BRIEFS } from "@/features/skillshot/legacy";
import { briefSlug, scaffoldBlueprint } from "@/features/skillshot/scaffold";
import { WAVE_ONE } from "@/features/skillshot/wave1";
import { parseBlueprint } from "@/features/skillshot/schema";
import type { Blueprint } from "@/features/skillshot/types";
import { DatabaseAgentRunRecorder } from "@/server/agents/database-recorder";
import { briefSchema, createInstructionalDesignAgent } from "@/server/agents/instructional-design";
import { AgentRunner } from "@/server/agents/runner";
import { CaptureError, audit, database, newUuid, rolesOf } from "@/server/capture/shared";
import { createDatabase } from "@/server/db/client";
import { kcLessons, skillShotDrafts } from "@/server/db/schema";
import { createProviders } from "@/server/providers";

type Row = typeof skillShotDrafts.$inferSelect;
export type DraftSummary = { id: string; slug: string; title: string; status: Row["status"]; source: string; passes: boolean; blockers: number; updatedAt: string };
export type DraftDetail = DraftSummary & {
  blueprint: Blueprint;
  review: Review;
  notes: string[];
  /** Set when the draft was built from a coach's lesson: the coach must approve the new wording before it is published. */
  fromLesson: { lessonId: string; approvedAt: string | null } | null;
  viewer: "staff" | "contributor";
  /** How much human review this needs, chosen by its risk, and why. */
  governance: Governance;
};
export type DraftAction = "submit" | "approve" | "request_changes" | "publish" | "retire";

async function requireStaff(userId: string): Promise<void> {
  const roles = await rolesOf(await database(), userId);
  if (!roles.has("editor") && !roles.has("admin")) throw new CaptureError(403, "Only an editor can design and review Skill Shots.");
}

const summarise = (row: Row): DraftSummary => {
  const review = row.review as unknown as Review;
  return { id: row.id, slug: row.slug, title: row.title, status: row.status, source: row.source, passes: Boolean(review?.passes), blockers: review?.blockers?.length ?? 0, updatedAt: row.updatedAt.toISOString() };
};
type Brief = { sourceLessonId?: string; contributorApprovedAt?: string | null; sourceKind?: "illustrative" | "method" | "design" | "expert-interview" | "document"; sourceNotes?: string };

/** The review path for a draft: from its topic, where its facts came from, whether it makes claims about real parties, and how sure the checks are. */
function governanceOf(row: Row): Governance {
  const brief = briefOf(row);
  const blueprint = row.blueprint as unknown as Blueprint;
  const review = row.review as unknown as Review;
  const text = [row.title, blueprint.design?.learningObjective, brief.sourceNotes].filter(Boolean).join(" ");
  const sourceKind = brief.sourceKind ?? "method";
  const figures = /\d+\s?%|[$₹€]\s?\d|\b\d{2,}\s?(percent|crore|lakh|million)\b/i.test(text);
  return governanceFor({ text, sourceKind, hasRealClaims: figures && (sourceKind === "expert-interview" || sourceKind === "document"), fromCoach: Boolean(brief.sourceLessonId), newContributor: false, enterpriseSensitive: false, confidence: review?.passes ? 0.9 : 0.4 });
}
const briefOf = (row: Row): Brief => ((row.brief as unknown as Brief | null) ?? {});
const detail = (row: Row, viewer: DraftDetail["viewer"] = "staff"): DraftDetail => {
  const brief = briefOf(row);
  return { ...summarise(row), blueprint: row.blueprint as unknown as Blueprint, review: row.review as unknown as Review, notes: (row.notes as string[] | null) ?? [], fromLesson: brief.sourceLessonId ? { lessonId: brief.sourceLessonId, approvedAt: brief.contributorApprovedAt ?? null } : null, viewer, governance: governanceOf(row) };
};

async function freeSlug(base: string): Promise<string> {
  const db = await database();
  for (let n = 1; n < 50; n += 1) {
    const slug = n === 1 ? base : `${base}-${n}`.slice(0, 80);
    const [taken] = await db.select({ id: skillShotDrafts.id }).from(skillShotDrafts).where(eq(skillShotDrafts.slug, slug)).limit(1);
    if (!taken) return slug;
  }
  throw new CaptureError(409, "Choose a more distinct topic name.");
}

type Queued = { id: string; slug: string; brief: z.infer<typeof briefSchema> };

async function insertDesigning(userId: string, brief: z.infer<typeof briefSchema>, slug: string, note: string): Promise<Queued> {
  const db = await database();
  const id = newUuid();
  const placeholder = { ...scaffoldBlueprint(brief), meta: { ...scaffoldBlueprint(brief).meta, id: slug } };
  await db.insert(skillShotDrafts).values({ id, slug, title: brief.topic.slice(0, 200), status: "designing", blueprint: placeholder as unknown as Record<string, unknown>, review: reviewBlueprint(placeholder) as unknown as Record<string, unknown>, brief: brief as unknown as Record<string, unknown>, notes: [note], source: "scaffold", createdBy: userId });
  return { id, slug, brief };
}

/**
 * The Instructional Design Agent drafts from a brief. The host cuts off long requests and an AI draft can take a minute, so this
 * saves a "designing" row and returns at once; the draft is filled in by the running server and the screen polls for it.
 * A draft is stored for review and never reaches a learner by itself.
 */
export async function designSkillShot(userId: string, rawBrief: unknown): Promise<DraftDetail> {
  await requireStaff(userId);
  const parsed = briefSchema.safeParse(rawBrief);
  if (!parsed.success) throw new CaptureError(400, `Check the brief: ${parsed.error.issues[0]?.message ?? "something is missing"}.`);
  // sourceLessonId is set only by designFromLesson, which checks the lesson; a brief typed in by hand cannot claim one.
  const brief = { ...parsed.data, sourceLessonId: undefined };
  const queued = await insertDesigning(userId, brief, await freeSlug(briefSlug(brief)), "The design agent is working on this draft.");
  const db = await database();
  await audit(db, userId, "skillshot.design", "skill_shot_draft", queued.id);
  void completeDesign(userId, queued.id, queued.slug, brief);
  const [row] = await db.select().from(skillShotDrafts).where(eq(skillShotDrafts.id, queued.id));
  return detail(row);
}

/**
 * Queues every brief in a list that has no draft yet and designs them one after another on the server, so the editor can close the
 * page. One at a time keeps the AI cost and the load on the host predictable. Used for content wave 1 and for the older Skill Shots.
 */
async function designBatch(userId: string, briefs: unknown[], action: string): Promise<{ queued: number; alreadyStarted: number }> {
  await requireStaff(userId);
  const db = await database();
  const existing = await db.select({ slug: skillShotDrafts.slug }).from(skillShotDrafts);
  const queue: Queued[] = [];
  for (const raw of briefs) {
    const brief = briefSchema.parse(raw);
    const base = briefSlug(brief);
    if (existing.some((row) => row.slug === base || row.slug.startsWith(`${base}-`))) continue;
    queue.push(await insertDesigning(userId, brief, base, "Waiting in the queue for the design agent."));
  }
  await audit(db, userId, action, "skill_shot_draft", null, { queued: queue.length });
  void runQueue(userId, queue);
  return { queued: queue.length, alreadyStarted: briefs.length - queue.length };
}

export const designWaveOne = (userId: string) => designBatch(userId, WAVE_ONE, "skillshot.wave1");
/** The five original Skill Shots, redesigned at their old addresses. They replace the old pages only when published. */
export const convertLegacySkillShots = (userId: string) => designBatch(userId, LEGACY_BRIEFS, "skillshot.legacy");

/** A coach's published lesson, redesigned as a Skill Shot. The coach approves the new wording before it can be published. */
export async function designFromLesson(userId: string, lessonId: string): Promise<DraftDetail> {
  await requireStaff(userId);
  const db = await database();
  const [lesson] = await db.select().from(kcLessons).where(eq(kcLessons.id, lessonId)).limit(1);
  if (!lesson) throw new CaptureError(404, "That lesson was not found.");
  if (lesson.status !== "published") throw new CaptureError(409, "Only a published lesson can be redesigned as a Skill Shot. The coach has already approved its wording.");
  const brief = briefSchema.parse(lessonBrief(lesson.spec as never, lesson.id));
  const [dup] = await db.select({ id: skillShotDrafts.id, status: skillShotDrafts.status }).from(skillShotDrafts).where(eq(skillShotDrafts.slug, briefSlug(brief))).limit(1);
  if (dup) throw new CaptureError(409, "This lesson already has a Skill Shot draft.");
  const queued = await insertDesigning(userId, brief, briefSlug(brief), "The design agent is working on this draft.");
  await audit(db, userId, "skillshot.fromLesson", "skill_shot_draft", queued.id, { lessonId });
  void completeDesign(userId, queued.id, queued.slug, brief);
  const [row] = await db.select().from(skillShotDrafts).where(eq(skillShotDrafts.id, queued.id));
  return detail(row);
}

async function runQueue(userId: string, queue: Array<{ id: string; slug: string; brief: z.infer<typeof briefSchema> }>): Promise<void> {
  const db = await database();
  for (let i = 0; i < queue.length; i += 1) {
    // Touching the rows still waiting keeps them from looking lost.
    for (let j = i + 1; j < queue.length; j += 1) {
      await db.update(skillShotDrafts).set({ notes: [`Waiting in the queue (${j - i} ahead of this one).`] }).where(and(eq(skillShotDrafts.id, queue[j].id), eq(skillShotDrafts.status, "designing"))).catch(() => undefined);
    }
    await db.update(skillShotDrafts).set({ notes: ["The design agent is working on this draft."] }).where(eq(skillShotDrafts.id, queue[i].id)).catch(() => undefined);
    await completeDesign(userId, queue[i].id, queue[i].slug, queue[i].brief);
  }
}

async function completeDesign(userId: string, id: string, slug: string, brief: z.infer<typeof briefSchema>): Promise<void> {
  const db = await database();
  try {
    const { ai } = createProviders();
    const runner = new AgentRunner(new DatabaseAgentRunRecorder(createDatabase(), ai));
    const result = await runner.run(createInstructionalDesignAgent(ai), brief, { userId });
    const blueprint = { ...result.blueprint, meta: { ...result.blueprint.meta, id: slug } };
    await db.update(skillShotDrafts).set({ title: blueprint.meta.title.slice(0, 200), status: "draft", blueprint: blueprint as unknown as Record<string, unknown>, review: reviewBlueprint(blueprint) as unknown as Record<string, unknown>, source: result.source, notes: result.notes }).where(eq(skillShotDrafts.id, id));
  } catch (error) {
    console.error("[skillshot design]", error instanceof Error ? error.message : error);
    await db.update(skillShotDrafts).set({ status: "failed", notes: ["The design could not be completed. Try again, or write the Skill Shot by hand from the structure."] }).where(eq(skillShotDrafts.id, id)).catch(() => undefined);
  }
}

/** A draft still "designing" after this long was lost (for example the server restarted), so it is marked failed instead of spinning forever. */
const STALE_MS = 6 * 60_000;
async function settleStale(): Promise<void> {
  const db = await database();
  const cutoff = new Date(Date.now() - STALE_MS);
  await db.update(skillShotDrafts).set({ status: "failed", notes: ["The design took too long and was stopped. Try again."] }).where(and(eq(skillShotDrafts.status, "designing"), lt(skillShotDrafts.updatedAt, cutoff)));
}

export async function listDrafts(userId: string): Promise<DraftSummary[]> {
  await requireStaff(userId);
  await settleStale();
  const db = await database();
  return (await db.select().from(skillShotDrafts).orderBy(desc(skillShotDrafts.updatedAt))).map(summarise);
}

async function isStaff(userId: string): Promise<boolean> {
  const roles = await rolesOf(await database(), userId);
  return roles.has("editor") || roles.has("admin");
}

/** The coach whose lesson a draft was built from: the only non-staff person who may see it, to approve their own words. */
async function isSourceContributor(row: Row, userId: string): Promise<boolean> {
  const lessonId = briefOf(row).sourceLessonId;
  if (!lessonId) return false;
  const [lesson] = await (await database()).select({ contributorId: kcLessons.contributorId }).from(kcLessons).where(eq(kcLessons.id, lessonId)).limit(1);
  return lesson?.contributorId === userId;
}

export async function getDraft(userId: string, id: string): Promise<DraftDetail> {
  await settleStale();
  const [row] = await (await database()).select().from(skillShotDrafts).where(eq(skillShotDrafts.id, id)).limit(1);
  if (!row) throw new CaptureError(404, "That Skill Shot was not found.");
  if (await isStaff(userId)) return detail(row);
  if (await isSourceContributor(row, userId)) return detail(row, "contributor");
  throw new CaptureError(404, "That Skill Shot was not found.");
}

/** Drafts built from the coach's own lessons that still wait for the coach to approve the wording. */
export async function listMyApprovals(userId: string): Promise<DraftSummary[]> {
  const db = await database();
  const rows = (await db.select().from(skillShotDrafts)).filter((row) => briefOf(row).sourceLessonId && !briefOf(row).contributorApprovedAt && ["draft", "in_review", "approved"].includes(row.status));
  const mine: Row[] = [];
  for (const row of rows) if (await isSourceContributor(row, userId)) mine.push(row);
  return mine.map(summarise);
}

/** The coach approves, or has changes made to, the Skill Shot built from their lesson. Editing the draft afterwards clears the approval. */
export async function contributorApproveDraft(userId: string, id: string): Promise<DraftDetail> {
  const db = await database();
  const [row] = await db.select().from(skillShotDrafts).where(eq(skillShotDrafts.id, id)).limit(1);
  if (!row || !(await isSourceContributor(row, userId))) throw new CaptureError(404, "That Skill Shot was not found.");
  if (!["draft", "in_review", "approved"].includes(row.status)) throw new CaptureError(409, "This Skill Shot is not waiting for approval.");
  await db.update(skillShotDrafts).set({ brief: { ...briefOf(row), contributorApprovedAt: new Date().toISOString() } as unknown as Record<string, unknown> }).where(eq(skillShotDrafts.id, id));
  await audit(db, userId, "skillshot.contributor_approve", "skill_shot_draft", id);
  return getDraft(userId, id);
}

/** An editor replaces the blueprint (for example to write the placeholders). It is validated and re-checked, and goes back to draft. */
export async function saveBlueprint(userId: string, id: string, raw: unknown): Promise<DraftDetail> {
  await requireStaff(userId);
  const db = await database();
  const [row] = await db.select().from(skillShotDrafts).where(eq(skillShotDrafts.id, id)).limit(1);
  if (!row) throw new CaptureError(404, "That Skill Shot was not found.");
  if (row.status === "published" || row.status === "retired") throw new CaptureError(409, "A published Skill Shot is not edited in place. Design a new version instead.");
  if (row.status === "designing") throw new CaptureError(409, "The design agent is still working on this draft.");
  const parsed = parseBlueprint(raw);
  if (!parsed.ok) throw new CaptureError(400, `The blueprint is not valid: ${parsed.errors.slice(0, 3).join("; ")}`);
  const blueprint: Blueprint = { ...parsed.blueprint, meta: { ...parsed.blueprint.meta, id: row.slug, reviewStatus: "draft" } };
  await db.update(skillShotDrafts).set({ blueprint: blueprint as unknown as Record<string, unknown>, review: reviewBlueprint(blueprint) as unknown as Record<string, unknown>, title: blueprint.meta.title.slice(0, 200), status: "draft", approvedBy: null, brief: { ...briefOf(row), contributorApprovedAt: null } as unknown as Record<string, unknown> }).where(eq(skillShotDrafts.id, id));
  await audit(db, userId, "skillshot.edit", "skill_shot_draft", id);
  return getDraft(userId, id);
}

const NEXT: Record<DraftAction, { from: Row["status"][]; to: Row["status"] }> = {
  submit: { from: ["draft"], to: "in_review" },
  approve: { from: ["in_review"], to: "approved" },
  request_changes: { from: ["in_review", "approved"], to: "draft" },
  publish: { from: ["approved"], to: "published" },
  retire: { from: ["published"], to: "retired" },
};

export async function draftAction(userId: string, id: string, action: DraftAction): Promise<DraftDetail> {
  await requireStaff(userId);
  const db = await database();
  await db.transaction(async (tx) => {
    const [row] = await tx.select().from(skillShotDrafts).where(eq(skillShotDrafts.id, id)).for("update");
    if (!row) throw new CaptureError(404, "That Skill Shot was not found.");
    const rule = NEXT[action];
    if (!rule || !rule.from.includes(row.status)) throw new CaptureError(409, `A ${row.status.replace("_", " ")} Skill Shot cannot ${action.replace("_", " ")}.`);
    const review = reviewBlueprint(row.blueprint as unknown as Blueprint);
    // The checks guard structure only, so approval and publication also need them clean; the person still judges the teaching.
    if ((action === "approve" || action === "publish" || action === "submit") && !review.passes) throw new CaptureError(409, `The checks still have ${review.blockers.length} point${review.blockers.length === 1 ? "" : "s"} to fix: ${review.blockers[0]}`);
    // Sensitive, regulated or low-confidence content needs an admin's approval to go live, not only an editor's.
    if (action === "publish" && governanceOf(row).mode === "C" && !(await rolesOf(tx, userId)).has("admin")) {
      throw new CaptureError(403, `This needs an admin to approve and publish it (${governanceOf(row).reasons[0]})`);
    }
    if (action === "publish" && briefOf(row).sourceLessonId) {
      if (!briefOf(row).contributorApprovedAt) throw new CaptureError(409, "The coach whose lesson this is built from needs to approve the wording first.");
      const [lesson] = await tx.select({ status: kcLessons.status }).from(kcLessons).where(eq(kcLessons.id, briefOf(row).sourceLessonId!)).limit(1);
      if (lesson?.status !== "published") throw new CaptureError(409, "The coach's lesson is no longer published, so this Skill Shot cannot be published.");
    }
    const blueprint = { ...(row.blueprint as unknown as Blueprint) };
    blueprint.meta = { ...blueprint.meta, reviewStatus: rule.to === "published" ? "published" : rule.to === "approved" ? "approved" : rule.to === "in_review" ? "in_review" : "draft" };
    await tx.update(skillShotDrafts).set({ status: rule.to, blueprint: blueprint as unknown as Record<string, unknown>, review: review as unknown as Record<string, unknown>, approvedBy: action === "approve" ? userId : action === "request_changes" ? null : row.approvedBy, publishedAt: action === "publish" ? new Date() : row.publishedAt }).where(eq(skillShotDrafts.id, id));
    await audit(tx, userId, `skillshot.${action}`, "skill_shot_draft", id);
  });
  return getDraft(userId, id);
}

/** What a learner may see: only published Skill Shots. */
export async function getPublishedBlueprint(slug: string): Promise<Blueprint | null> {
  const db = await database();
  const [row] = await db.select().from(skillShotDrafts).where(eq(skillShotDrafts.slug, slug)).limit(1);
  return row && row.status === "published" ? (row.blueprint as unknown as Blueprint) : null;
}

export async function listPublishedBlueprints(): Promise<Blueprint[]> {
  const db = await database();
  return (await db.select().from(skillShotDrafts).where(eq(skillShotDrafts.status, "published"))).map((row) => row.blueprint as unknown as Blueprint);
}
