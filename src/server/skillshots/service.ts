import "server-only";

import { and, desc, eq, lt } from "drizzle-orm";
import type { z } from "zod";

import { reviewBlueprint, type Review } from "@/features/skillshot/rubric";
import { scaffoldBlueprint, slugOf } from "@/features/skillshot/scaffold";
import { parseBlueprint } from "@/features/skillshot/schema";
import type { Blueprint } from "@/features/skillshot/types";
import { DatabaseAgentRunRecorder } from "@/server/agents/database-recorder";
import { briefSchema, createInstructionalDesignAgent } from "@/server/agents/instructional-design";
import { AgentRunner } from "@/server/agents/runner";
import { CaptureError, audit, database, newUuid, rolesOf } from "@/server/capture/shared";
import { createDatabase } from "@/server/db/client";
import { skillShotDrafts } from "@/server/db/schema";
import { createProviders } from "@/server/providers";

type Row = typeof skillShotDrafts.$inferSelect;
export type DraftSummary = { id: string; slug: string; title: string; status: Row["status"]; source: string; passes: boolean; blockers: number; updatedAt: string };
export type DraftDetail = DraftSummary & { blueprint: Blueprint; review: Review; notes: string[] };
export type DraftAction = "submit" | "approve" | "request_changes" | "publish" | "retire";

async function requireStaff(userId: string): Promise<void> {
  const roles = await rolesOf(await database(), userId);
  if (!roles.has("editor") && !roles.has("admin")) throw new CaptureError(403, "Only an editor can design and review Skill Shots.");
}

const summarise = (row: Row): DraftSummary => {
  const review = row.review as unknown as Review;
  return { id: row.id, slug: row.slug, title: row.title, status: row.status, source: row.source, passes: Boolean(review?.passes), blockers: review?.blockers?.length ?? 0, updatedAt: row.updatedAt.toISOString() };
};
const detail = (row: Row): DraftDetail => ({ ...summarise(row), blueprint: row.blueprint as unknown as Blueprint, review: row.review as unknown as Review, notes: (row.notes as string[] | null) ?? [] });

async function freeSlug(base: string): Promise<string> {
  const db = await database();
  for (let n = 1; n < 50; n += 1) {
    const slug = n === 1 ? base : `${base}-${n}`.slice(0, 80);
    const [taken] = await db.select({ id: skillShotDrafts.id }).from(skillShotDrafts).where(eq(skillShotDrafts.slug, slug)).limit(1);
    if (!taken) return slug;
  }
  throw new CaptureError(409, "Choose a more distinct topic name.");
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
  const brief = parsed.data;
  const db = await database();
  const id = newUuid();
  const slug = await freeSlug(slugOf(brief.topic));
  const placeholder = { ...scaffoldBlueprint(brief), meta: { ...scaffoldBlueprint(brief).meta, id: slug } };
  await db.insert(skillShotDrafts).values({ id, slug, title: brief.topic.slice(0, 200), status: "designing", blueprint: placeholder as unknown as Record<string, unknown>, review: reviewBlueprint(placeholder) as unknown as Record<string, unknown>, brief: brief as unknown as Record<string, unknown>, notes: ["The design agent is working on this draft."], source: "scaffold", createdBy: userId });
  await audit(db, userId, "skillshot.design", "skill_shot_draft", id);
  void completeDesign(userId, id, slug, brief);
  const [row] = await db.select().from(skillShotDrafts).where(eq(skillShotDrafts.id, id));
  return detail(row);
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

export async function getDraft(userId: string, id: string): Promise<DraftDetail> {
  await requireStaff(userId);
  await settleStale();
  const [row] = await (await database()).select().from(skillShotDrafts).where(eq(skillShotDrafts.id, id)).limit(1);
  if (!row) throw new CaptureError(404, "That Skill Shot was not found.");
  return detail(row);
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
  await db.update(skillShotDrafts).set({ blueprint: blueprint as unknown as Record<string, unknown>, review: reviewBlueprint(blueprint) as unknown as Record<string, unknown>, title: blueprint.meta.title.slice(0, 200), status: "draft", approvedBy: null }).where(eq(skillShotDrafts.id, id));
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
