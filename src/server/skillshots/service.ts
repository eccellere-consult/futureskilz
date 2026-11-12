import "server-only";

import { and, desc, eq, like, lt } from "drizzle-orm";
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
import type { RatingSummary } from "@/features/skillshot/rating";
import { CaptureError, audit, database, newUuid, requireProject, rolesOf } from "@/server/capture/shared";

import { ratingSummaries } from "./ratings";
import { createDatabase } from "@/server/db/client";
import { bookProjects, kcDocuments, kcLessons, kcProjects, kcSegments, kcUploads, skillShotDrafts, users } from "@/server/db/schema";
import { materialBrief, planMaterial } from "@/features/skillshot/from-material";
import { pieceBrief, planPieces } from "@/features/skillshot/from-package";
import type { KnowledgePackage } from "@/features/capture/knowledge-package";
import { chapterBrief } from "@/features/book/training";
import type { Book } from "@/features/book/types";
import { createProviders } from "@/server/providers";
import { isPilotOn } from "@/server/pilot/pilot";

type Row = typeof skillShotDrafts.$inferSelect;
export type DraftSummary = { id: string; slug: string; title: string; status: Row["status"]; source: string; passes: boolean; blockers: number; updatedAt: string; /** Learners' star ratings, where the list shows them. */ rating?: RatingSummary | null };
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
type Brief = { sourceLessonId?: string; sourceProjectId?: string; autopilot?: boolean; contributorApprovedAt?: string | null; sourceKind?: "illustrative" | "method" | "design" | "expert-interview" | "document"; sourceNotes?: string };

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
  const brief = { ...parsed.data, sourceLessonId: undefined, sourceProjectId: undefined, autopilot: undefined };
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

/** The chapters of an author-approved book, designed as Skill Shot drafts. Editors review them before any learner sees them. */
export async function designFromBook(userId: string, projectId: string): Promise<{ queued: number; alreadyStarted: number }> {
  await requireStaff(userId);
  const db = await database();
  const [row] = await db.select().from(bookProjects).where(eq(bookProjects.projectId, projectId)).limit(1);
  if (!row?.book) throw new CaptureError(404, "That project has no book yet.");
  if (row.status !== "approved") throw new CaptureError(409, "The author has not approved the book yet. Training is made only from an approved book.");
  const book = row.book as unknown as Book;
  const tag = projectId.replace(/-/g, "").slice(0, 8);
  const existing = await db.select({ slug: skillShotDrafts.slug }).from(skillShotDrafts);
  const queue: Queued[] = [];
  for (const chapter of book.chapters) {
    const brief = briefSchema.parse(chapterBrief(book, chapter, tag));
    if (existing.some((draft) => draft.slug === brief.slug)) continue;
    queue.push(await insertDesigning(userId, brief, brief.slug ?? briefSlug(brief), "Waiting in the queue for the design agent."));
  }
  await audit(db, userId, "skillshot.fromBook", "book_project", row.id, { queued: queue.length });
  void runQueue(userId, queue);
  return { queued: queue.length, alreadyStarted: book.chapters.length - queue.length };
}

/**
 * Designs a Skill Shot draft for each brief that has none yet, one after another on the server. The caller has already checked that the
 * person may do this. Drafts are for an editor to review; nothing reaches a learner from here.
 */
export async function designBriefsFor(userId: string, briefs: Array<{ slug: string; brief: unknown }>, action: string, entity: string, entityId: string): Promise<{ queued: number; alreadyStarted: number }> {
  const db = await database();
  const existing = await db.select({ slug: skillShotDrafts.slug }).from(skillShotDrafts);
  const queue: Queued[] = [];
  for (const item of briefs) {
    if (existing.some((row) => row.slug === item.slug)) continue;
    const brief = briefSchema.parse({ ...(item.brief as object), slug: item.slug });
    queue.push(await insertDesigning(userId, brief, item.slug, "Waiting in the queue for the design agent."));
  }
  await audit(db, userId, action, entity, entityId, { queued: queue.length });
  void runQueue(userId, queue);
  return { queued: queue.length, alreadyStarted: briefs.length - queue.length };
}

/**
 * The direct route (pilot): a Skill Shot for each part of the project's own text, uploads and the person's interview answers alike,
 * with no confirm or approval step in between. Failed drafts are cleared and made again. Returns how many were started, and how much
 * text there was, so the caller can say plainly why nothing started.
 */
export async function designFromMaterial(userId: string, projectId: string, limit: number): Promise<{ queued: number; alreadyStarted: number; chars: number; lessons: number; remaining: number }> {
  const db = await database();
  const project = await requireProject(db, userId, projectId, { staff: true });
  const rows = await db.select({ text: kcSegments.text, speaker: kcSegments.speaker, locator: kcSegments.locator, seq: kcSegments.seq, uploadId: kcSegments.uploadId }).from(kcSegments).where(eq(kcSegments.projectId, projectId));
  const said = rows.filter((row) => row.speaker === "expert" && row.text.trim()).sort((a, b) => a.seq - b.seq);
  // With several files in one project, each file starts its own part of the course, named after the file.
  const files = await db.select({ id: kcUploads.id, filename: kcUploads.filename }).from(kcUploads).where(eq(kcUploads.projectId, projectId));
  const several = new Set(said.map((row) => row.uploadId).filter(Boolean)).size > 1;
  let lastFile: string | null = null;
  const text = said
    .map((row) => {
      const opens = several && Boolean(row.uploadId) && row.uploadId !== lastFile;
      lastFile = row.uploadId ?? lastFile;
      const name = opens ? (files.find((file) => file.id === row.uploadId)?.filename ?? "").replace(/\.[a-z0-9]{2,5}$/i, "").replace(/[_-]+/g, " ").trim() : "";
      return `${name ? `# ${name}\n` : ""}${row.text.trim()}`;
    })
    .join("\n\n");
  const course = planMaterial(text);
  if (!course.length) return { queued: 0, alreadyStarted: 0, chars: text.length, lessons: 0, remaining: 0 };
  const [owner] = await db.select({ name: users.displayName }).from(users).where(eq(users.id, project.contributorId)).limit(1);
  const tag = projectId.replace(/-/g, "").slice(0, 8);
  const all = course.map((part) => materialBrief(part, { title: project.title, contributor: owner?.name ?? "The contributor", projectId, tag }));
  // One run starts the next few lessons that are not made yet, in the course's order, so a long document is finished over a few runs.
  const made = await db.select().from(skillShotDrafts).where(like(skillShotDrafts.slug, `doc-${tag}-%`));
  const waiting = all.filter((brief) => { const row = made.find((draft) => draft.slug === brief.slug); return !row || isScrap(row); });
  const briefs = waiting.slice(0, limit);
  // Autopilot repairs itself: a draft that failed, or is only the empty structure, is cleared so that part is designed again.
  for (const brief of briefs) {
    const [old] = await db.select().from(skillShotDrafts).where(eq(skillShotDrafts.slug, brief.slug)).limit(1);
    if (old && isScrap(old)) await db.delete(skillShotDrafts).where(eq(skillShotDrafts.id, old.id));
  }
  const result = await designBriefsFor(userId, briefs.map((brief) => ({ slug: brief.slug, brief })), "skillshot.fromMaterial", "kc_project", projectId);
  return { queued: result.queued, alreadyStarted: all.length - waiting.length, chars: text.length, lessons: all.length, remaining: waiting.length - briefs.length };
}

/** What a contributor's approved material would become, and what is left out and why. Nothing is created. */
async function loadApprovedPackage(userId: string, projectId: string) {
  const db = await database();
  const project = await requireProject(db, userId, projectId, { staff: true });
  const approved = (await db.select().from(kcDocuments).where(and(eq(kcDocuments.projectId, projectId), eq(kcDocuments.kind, "knowledge_package"))).orderBy(desc(kcDocuments.version))).find((row) => row.status === "approved" || row.status === "published");
  if (!approved) throw new CaptureError(409, "Approve the knowledge package first. Skill Shots are made only from what you have confirmed.");
  const [owner] = await db.select({ name: users.displayName }).from(users).where(eq(users.id, project.contributorId)).limit(1);
  const tag = projectId.replace(/-/g, "").slice(0, 8);
  // The package is stored as JSON text, so it is read back into its sections first.
  const content = typeof approved.content === "string" ? (JSON.parse(approved.content) as KnowledgePackage) : (approved.content as unknown as KnowledgePackage);
  const plan = planPieces({ sections: Array.isArray(content?.sections) ? content.sections : [] }, project.title, tag);
  return { project, plan, contributor: owner?.name ?? "The contributor", tag };
}

export async function previewFromProject(userId: string, projectId: string) {
  const { plan } = await loadApprovedPackage(userId, projectId);
  const db = await database();
  const existing = await db.select({ slug: skillShotDrafts.slug, id: skillShotDrafts.id, status: skillShotDrafts.status }).from(skillShotDrafts);
  return {
    pieces: plan.pieces.map((piece) => {
      const draft = existing.find((row) => row.slug === piece.key);
      return { key: piece.key, title: piece.title, statements: piece.items.length, draftId: draft?.id ?? null, draftStatus: draft?.status ?? null };
    }),
    leftOut: plan.leftOut,
  };
}

/** The contributor (or an editor) turns the confirmed material into Skill Shot drafts. An editor still reviews each before a learner sees it. */
export async function designFromProject(userId: string, projectId: string, keys?: string[], options: { autopilot?: boolean; limit?: number } = {}): Promise<{ queued: number; alreadyStarted: number }> {
  const { plan, contributor } = await loadApprovedPackage(userId, projectId);
  const db = await database();
  const chosen = plan.pieces.filter((piece) => !keys || keys.includes(piece.key)).slice(0, options.limit ?? 60);
  if (!chosen.length) throw new CaptureError(409, "There is nothing in the approved package to make a Skill Shot from yet. Confirm more knowledge first.");
  // Autopilot repairs itself: a draft that failed is cleared so the piece is designed again.
  if (options.autopilot) for (const piece of chosen) await db.delete(skillShotDrafts).where(and(eq(skillShotDrafts.slug, piece.key), eq(skillShotDrafts.status, "failed")));
  const existing = await db.select({ slug: skillShotDrafts.slug }).from(skillShotDrafts);
  const queue: Queued[] = [];
  for (const piece of chosen) {
    if (existing.some((row) => row.slug === piece.key)) continue;
    const brief = briefSchema.parse({ ...pieceBrief(piece, { contributor, projectId }), ...(options.autopilot ? { autopilot: true } : {}) });
    queue.push(await insertDesigning(userId, brief, piece.key, "Waiting in the queue for the design agent."));
  }
  await audit(db, userId, "skillshot.fromProject", "kc_project", projectId, { queued: queue.length });
  void runQueue(userId, queue);
  return { queued: queue.length, alreadyStarted: chosen.length - queue.length };
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
    // Autopilot repairs itself: one more try if the design fails outright.
    let result = await runner.run(createInstructionalDesignAgent(ai), brief, { userId }).catch((error: unknown) => {
      if (!brief.autopilot) throw error;
      return null;
    });
    if (!result) result = await runner.run(createInstructionalDesignAgent(ai), brief, { userId });
    const blueprint = { ...result.blueprint, meta: { ...result.blueprint.meta, id: slug } };
    // Pilot: when the checks pass, Autopilot drafts are approved at once. Approved is staff-only; only "publish" reaches learners.
    const auto = Boolean(brief.autopilot) && reviewBlueprint(blueprint).passes && (await isPilotOn());
    if (auto) blueprint.meta = { ...blueprint.meta, reviewStatus: "approved" };
    await db.update(skillShotDrafts).set({ title: blueprint.meta.title.slice(0, 200), status: auto ? "approved" : "draft", approvedBy: auto ? userId : null, blueprint: blueprint as unknown as Record<string, unknown>, review: reviewBlueprint(blueprint) as unknown as Record<string, unknown>, source: result.source, notes: result.notes }).where(eq(skillShotDrafts.id, id));
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

/** The Skill Shot drafts made from one project, newest first, for the person running the pilot to watch and open. */
export async function listProjectDrafts(userId: string, projectId: string): Promise<Array<DraftSummary & { notes: string[] }>> {
  await requireStaff(userId);
  await settleStale();
  const db = await database();
  return (await db.select().from(skillShotDrafts).orderBy(desc(skillShotDrafts.updatedAt))).filter((row) => briefOf(row).sourceProjectId === projectId).map((row) => ({ ...summarise(row), notes: (row.notes as string[] | null) ?? [] }));
}

/** The newest slide format gives every slide a takeaway line. A Skill Shot without them was made under older rules. */
const isLatestFormat = (row: Row): boolean => {
  const scenes = (row.blueprint as unknown as Blueprint).scenes ?? [];
  return scenes.length > 0 && scenes.every((scene) => Boolean(scene.takeaway));
};
const REFRESH_LIMIT = 30;

/** How many Skill Shots were made under older rules and can be refreshed. */
export async function countRefreshable(userId: string): Promise<number> {
  await requireStaff(userId);
  return (await (await database()).select().from(skillShotDrafts)).filter(canRefresh).length;
}
const canRefresh = (row: Row): boolean => ["draft", "in_review", "approved", "published"].includes(row.status) && row.source === "ai" && Boolean(briefOf(row).sourceNotes) && !isLatestFormat(row);

/**
 * Brings older Skill Shots up to today's rules in one go: each is designed again from the same reference it was first made from
 * (consulting-style slides, diagrams, full spoken length). The new version replaces the old one ONLY when it is at least as clean
 * on the checks; otherwise the earlier version stays exactly as it was, with a note. Status, address and learners' progress are
 * kept. Runs one after another on the server, up to thirty a press; press again for the rest.
 */
export async function refreshAllDrafts(userId: string): Promise<{ queued: number; left: number }> {
  await requireStaff(userId);
  const db = await database();
  const rows = (await db.select().from(skillShotDrafts).orderBy(desc(skillShotDrafts.updatedAt))).filter(canRefresh);
  const batch = rows.slice(0, REFRESH_LIMIT);
  await audit(db, userId, "skillshot.refresh_all", "skill_shot_draft", null, { queued: batch.length });
  void (async () => {
    for (const row of batch) await refreshOne(userId, row).catch((error: unknown) => console.error("[skillshot refresh]", error instanceof Error ? error.message : error));
  })();
  return { queued: batch.length, left: rows.length - batch.length };
}

async function refreshOne(userId: string, row: Row): Promise<void> {
  const db = await database();
  const keep = (note: string) => db.update(skillShotDrafts).set({ notes: [...((row.notes as string[] | null) ?? []).filter((line) => !line.startsWith("Refresh")), note] }).where(eq(skillShotDrafts.id, row.id));
  const parsed = briefSchema.safeParse(row.brief);
  if (!parsed.success) return void (await keep("Refresh skipped: the original reference for this Skill Shot is not stored."));
  const { ai } = createProviders();
  const runner = new AgentRunner(new DatabaseAgentRunRecorder(createDatabase(), ai));
  const result = await runner.run(createInstructionalDesignAgent(ai), parsed.data, { userId });
  const before = (row.review as unknown as Review)?.blockers?.length ?? 0;
  const blueprint: Blueprint = { ...result.blueprint, meta: { ...result.blueprint.meta, id: row.slug, reviewStatus: row.status === "published" ? "published" : row.status === "approved" ? "approved" : row.status === "in_review" ? "in_review" : "draft" } };
  const review = reviewBlueprint(blueprint);
  // Never make a Skill Shot worse: a published or approved one must still pass; a draft must not gain points to fix.
  const good = result.source === "ai" && (row.status === "published" || row.status === "approved" ? review.passes : review.blockers.length <= before);
  if (!good) return void (await keep("Refresh tried: the new version did not do as well on the checks, so the earlier version was kept."));
  await db.update(skillShotDrafts).set({ title: blueprint.meta.title.slice(0, 200), blueprint: blueprint as unknown as Record<string, unknown>, review: review as unknown as Record<string, unknown>, notes: ["Refreshed to the latest slide format."] }).where(eq(skillShotDrafts.id, row.id));
}

const isScrap = (row: Row): boolean => (Boolean(briefOf(row).autopilot) || Boolean(briefOf(row).sourceProjectId)) && (row.status === "failed" || ((row.status === "draft" || row.status === "in_review") && row.source === "scaffold"));

/**
 * Clears the scrap in one go: Skill Shot drafts made from material that failed, or that are only the empty structure with
 * placeholders because the AI's reply could not be used. Anything with real AI content, anything approved and anything
 * published is kept. Deleting a scrap draft also lets the same material be designed again.
 */
export async function deleteScrapDrafts(userId: string): Promise<{ removed: number }> {
  await requireStaff(userId);
  await settleStale();
  const db = await database();
  const scrap = (await db.select().from(skillShotDrafts)).filter(isScrap);
  for (const row of scrap) await db.delete(skillShotDrafts).where(eq(skillShotDrafts.id, row.id));
  if (scrap.length) await audit(db, userId, "skillshot.delete_scrap", "skill_shot_draft", null, { removed: scrap.length });
  return { removed: scrap.length };
}

/** One draft, deleted by an editor or admin. A published Skill Shot is retired, not deleted. */
export async function deleteDraft(userId: string, id: string): Promise<void> {
  await requireStaff(userId);
  const db = await database();
  const [row] = await db.select().from(skillShotDrafts).where(eq(skillShotDrafts.id, id)).limit(1);
  if (!row) throw new CaptureError(404, "That Skill Shot was not found.");
  if (row.status === "published") throw new CaptureError(409, "A published Skill Shot is retired, not deleted.");
  await db.delete(skillShotDrafts).where(eq(skillShotDrafts.id, id));
  await audit(db, userId, "skillshot.delete", "skill_shot_draft", id, { status: row.status });
}

/** Everything Autopilot has made, newest first: for the one screen that shows what was made, what is ready and what failed. */
export async function listAutopilotDrafts(userId: string): Promise<Array<DraftSummary & { scrap: boolean }>> {
  await requireStaff(userId);
  await settleStale();
  const db = await database();
  return (await db.select().from(skillShotDrafts).orderBy(desc(skillShotDrafts.updatedAt))).filter((row) => briefOf(row).autopilot).map((row) => ({ ...summarise(row), scrap: isScrap(row) }));
}

export async function listDrafts(userId: string): Promise<DraftSummary[]> {
  await requireStaff(userId);
  await settleStale();
  const db = await database();
  const rows = await db.select().from(skillShotDrafts).orderBy(desc(skillShotDrafts.updatedAt));
  // Learners' stars beside each one. If the ratings cannot be read, the list still shows.
  const ratings = await ratingSummaries(rows.map((row) => row.slug)).catch(() => new Map<string, RatingSummary>());
  return rows.map((row) => ({ ...summarise(row), rating: ratings.get(row.slug) ?? null }));
}

async function isStaff(userId: string): Promise<boolean> {
  const roles = await rolesOf(await database(), userId);
  return roles.has("editor") || roles.has("admin");
}

/** The coach whose lesson a draft was built from: the only non-staff person who may see it, to approve their own words. */
async function isSourceContributor(row: Row, userId: string): Promise<boolean> {
  const projectId = briefOf(row).sourceProjectId;
  if (projectId) {
    const [project] = await (await database()).select({ contributorId: kcProjects.contributorId }).from(kcProjects).where(eq(kcProjects.id, projectId)).limit(1);
    return project?.contributorId === userId;
  }
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
