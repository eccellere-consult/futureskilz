import "server-only";

import { and, desc, eq, gt, lte, sql } from "drizzle-orm";
import { z } from "zod";

import { campaigns } from "@/server/db/schema";

import { CaptureError, audit, database, iso, rolesOf, type Executor } from "./shared";

async function requireAdmin(executor: Executor, userId: string): Promise<void> {
  if (!(await rolesOf(executor, userId)).has("admin")) throw new CaptureError(403, "Only an admin can manage campaigns.");
}

export const campaignSchema = z
  .object({
    name: z.string().trim().min(3).max(120),
    kind: z.enum(["discount", "free_access", "featured"]),
    code: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{3,40}$/, "A code is 3 to 40 letters, numbers or dashes.").optional().or(z.literal("").transform(() => undefined)),
    percentOffBp: z.number().int().min(0).max(10000).default(0),
    extraFreePerPillar: z.number().int().min(0).max(20).default(0),
    startsAt: z.string(),
    endsAt: z.string(),
    maxRedemptions: z.number().int().min(1).max(1_000_000).nullable().optional(),
    notes: z.string().trim().max(1000).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.kind === "discount" && (value.percentOffBp <= 0 || !value.code)) ctx.addIssue({ code: "custom", message: "A discount needs a code and a percentage off." });
    if (value.kind === "free_access" && value.extraFreePerPillar <= 0) ctx.addIssue({ code: "custom", message: "Free access needs at least one extra free Skill Shot per pillar." });
    if (new Date(value.endsAt) <= new Date(value.startsAt)) ctx.addIssue({ code: "custom", message: "The campaign must end after it starts." });
  });

export type CampaignRow = { id: string; name: string; kind: string; code: string | null; percentOffBp: number; extraFreePerPillar: number; startsAt: string; endsAt: string; maxRedemptions: number | null; redemptions: number; status: string; live: boolean; notes: string | null };

const toRow = (row: typeof campaigns.$inferSelect): CampaignRow => {
  const now = Date.now();
  return { id: row.id, name: row.name, kind: row.kind, code: row.code, percentOffBp: row.percentOffBp, extraFreePerPillar: row.extraFreePerPillar, startsAt: iso(row.startsAt), endsAt: iso(row.endsAt), maxRedemptions: row.maxRedemptions, redemptions: row.redemptions, status: row.status, notes: row.notes, live: row.status === "active" && row.startsAt.getTime() <= now && row.endsAt.getTime() > now && (row.maxRedemptions === null || row.redemptions < row.maxRedemptions) };
};

export async function listCampaigns(userId: string): Promise<CampaignRow[]> {
  const db = await database();
  await requireAdmin(db, userId);
  return (await db.select().from(campaigns).orderBy(desc(campaigns.createdAt)).limit(200)).map(toRow);
}

export async function createCampaign(userId: string, raw: unknown): Promise<CampaignRow> {
  const db = await database();
  await requireAdmin(db, userId);
  const parsed = campaignSchema.safeParse(raw);
  if (!parsed.success) throw new CaptureError(422, parsed.error.issues[0]?.message ?? "Check the campaign details.");
  const v = parsed.data;
  if (v.code) {
    const [clash] = await db.select({ id: campaigns.id }).from(campaigns).where(eq(campaigns.code, v.code)).limit(1);
    if (clash) throw new CaptureError(409, "That code is already used by another campaign.");
  }
  const id = crypto.randomUUID();
  await db.insert(campaigns).values({ id, name: v.name, kind: v.kind, code: v.code ?? null, percentOffBp: v.percentOffBp, extraFreePerPillar: v.extraFreePerPillar, startsAt: new Date(v.startsAt), endsAt: new Date(v.endsAt), maxRedemptions: v.maxRedemptions ?? null, notes: v.notes ?? null, createdBy: userId });
  await audit(db, userId, "campaign.create", "campaign", id, { kind: v.kind });
  const [row] = await db.select().from(campaigns).where(eq(campaigns.id, id));
  return toRow(row);
}

export async function setCampaignStatus(userId: string, id: string, status: "active" | "paused" | "ended"): Promise<CampaignRow> {
  const db = await database();
  await requireAdmin(db, userId);
  const [row] = await db.select().from(campaigns).where(eq(campaigns.id, id)).limit(1);
  if (!row) throw new CaptureError(404, "That campaign was not found.");
  if (row.status === "ended") throw new CaptureError(409, "An ended campaign cannot be changed. Create a new one.");
  await db.update(campaigns).set({ status }).where(eq(campaigns.id, id));
  await audit(db, userId, `campaign.${status}`, "campaign", id);
  const [fresh] = await db.select().from(campaigns).where(eq(campaigns.id, id));
  return toRow(fresh);
}

/** A live discount by its code, for checkout. Returns null for an unknown, paused, expired or used-up code. */
export async function liveDiscountByCode(code: string, executor?: Executor): Promise<{ id: string; percentOffBp: number } | null> {
  const db = executor ?? (await database());
  const now = new Date();
  const [row] = await db.select().from(campaigns).where(and(eq(campaigns.code, code.trim().toUpperCase()), eq(campaigns.kind, "discount"), eq(campaigns.status, "active"), lte(campaigns.startsAt, now), gt(campaigns.endsAt, now))).limit(1);
  if (!row || (row.maxRedemptions !== null && row.redemptions >= row.maxRedemptions)) return null;
  return { id: row.id, percentOffBp: row.percentOffBp };
}

/** Counts one redemption, refusing when the limit is reached. Done in a single statement so two buyers cannot take the last one. */
export async function redeemCampaign(id: string, executor?: Executor): Promise<boolean> {
  const db = executor ?? (await database());
  const [result] = await db.update(campaigns).set({ redemptions: sql`${campaigns.redemptions} + 1` }).where(and(eq(campaigns.id, id), sql`(${campaigns.maxRedemptions} is null or ${campaigns.redemptions} < ${campaigns.maxRedemptions})`));
  return ((result as unknown as { affectedRows?: number })?.affectedRows ?? 0) > 0;
}

/** Extra free Skill Shots per pillar from live free-access campaigns (the largest one applies; they do not stack). */
export async function extraFreePerPillar(executor?: Executor): Promise<number> {
  const db = executor ?? (await database());
  const now = new Date();
  const rows = await db.select().from(campaigns).where(and(eq(campaigns.kind, "free_access"), eq(campaigns.status, "active"), lte(campaigns.startsAt, now), gt(campaigns.endsAt, now)));
  return rows.reduce((max, row) => Math.max(max, row.extraFreePerPillar), 0);
}
