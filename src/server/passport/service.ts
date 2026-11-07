import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { and, desc, eq, gt, isNull } from "drizzle-orm";

import { skillFamilies, skillTaxonomy } from "@/domain/skills/taxonomy";
import { getSkillShot } from "@/features/journey/model";
import { estimateSkills } from "@/features/pathway/estimate";
import { getRole } from "@/features/pathway/roles";
import { DEFAULT_SHARE, applyPrivacy, summariseBasis, type Passport, type PassportEvidence, type PassportSkill, type ShareOptions } from "@/features/passport/model";
import { CaptureError } from "@/server/capture/shared";
import { allow } from "@/server/coach/service";
import { createDatabase } from "@/server/db/client";
import { learnerDiagnostic, passportShares, skillEvidence, skills } from "@/server/db/schema";
import { learnerRepository } from "@/server/learning/service";
import { loadTargetRole } from "@/server/pathway/target-role";
import { findDesigned } from "@/server/skillshots/designed";

const familyName = new Map(skillFamilies.map((family) => [family.id, family.name]));
const skillInfo = new Map(skillTaxonomy.map((skill) => [skill.slug, { name: skill.name, family: familyName.get(skill.familyId) ?? "" }]));

/** The learner's passport, built from the same estimates the gap table uses, so the two never disagree. */
export async function buildPassport(userId: string): Promise<Passport> {
  const db = createDatabase();
  const snapshot = await learnerRepository().loadSnapshot(userId);
  const estimates = estimateSkills(snapshot.scores, [], snapshot.skillLevels ?? [], snapshot.diagnostic ?? []);

  const list: PassportSkill[] = [];
  let inferred = 0;
  for (const [skill, estimate] of estimates) {
    const info = skillInfo.get(skill);
    if (!info || estimate.level === null || estimate.source === "none") continue;
    // A skill guessed from a related answer is not something the learner rated, described or completed, so it is not listed.
    if (estimate.source === "inferred") {
      inferred += 1;
      continue;
    }
    list.push({ skill, name: info.name, family: info.family, level: Number(estimate.level.toFixed(1)), confidence: Number(estimate.confidence.toFixed(2)), source: estimate.source, withResult: Boolean(estimate.withResult) });
  }
  list.sort((a, b) => a.family.localeCompare(b.family) || b.level - a.level || a.name.localeCompare(b.name));

  const rows = await db.select({ source: skillEvidence.source, createdAt: skillEvidence.createdAt, slug: skills.slug }).from(skillEvidence).innerJoin(skills, eq(skills.id, skillEvidence.skillId)).where(eq(skillEvidence.learnerId, userId)).orderBy(desc(skillEvidence.createdAt));
  const grouped = new Map<string, { kind: "skill-shot"; titleOf: string; date: Date; skills: Set<string> }>();
  for (const row of rows) {
    const parts = row.source.split(":");
    const key = parts[0] === "designed" ? `designed:${parts[1]}` : row.source;
    if (parts[0] !== "designed" && parts[0] !== "skill-shot") continue;
    const entry = grouped.get(key) ?? { kind: "skill-shot" as const, titleOf: key, date: row.createdAt, skills: new Set<string>() };
    entry.skills.add(row.slug);
    grouped.set(key, entry);
  }
  const evidence: PassportEvidence[] = [];
  for (const [key, entry] of grouped) {
    const title = key.startsWith("designed:") ? (await findDesigned(key.slice("designed:".length)))?.meta.title : getSkillShot(key.slice("skill-shot:".length))?.title;
    if (title) evidence.push({ title, kind: "skill-shot", date: entry.date.toISOString().slice(0, 10), skills: [...entry.skills] });
  }
  const [diagnostic] = await db.select({ completedAt: learnerDiagnostic.completedAt }).from(learnerDiagnostic).where(eq(learnerDiagnostic.userId, userId)).limit(1);
  if (diagnostic?.completedAt) evidence.push({ title: "A conversation about recent situations", kind: "conversation", date: diagnostic.completedAt.toISOString().slice(0, 10), skills: [] });
  evidence.sort((a, b) => b.date.localeCompare(a.date));

  const targetId = await loadTargetRole(userId);
  return { name: snapshot.draft.name, currentRole: snapshot.draft.currentRole, targetRole: targetId ? (getRole(targetId)?.title ?? null) : null, generatedAt: new Date().toISOString(), skills: list, evidence, basis: summariseBasis(list, inferred) };
}

const hash = (token: string) => createHash("sha256").update(token).digest("hex");
const TOKEN = /^[A-Za-z0-9_-]{43}$/;
export const SHARE_DAYS = [7, 30, 90] as const;
const MAX_ACTIVE = 10;

export type ShareSummary = { id: string; label: string; include: ShareOptions; expiresAt: string; revokedAt: string | null; views: number; lastViewedAt: string | null; createdAt: string; active: boolean };

const asOptions = (value: Record<string, boolean>): ShareOptions => ({ name: Boolean(value.name), targetRole: Boolean(value.targetRole), evidence: Boolean(value.evidence) });

export async function createShare(userId: string, input: { label?: string; include?: Partial<ShareOptions>; days?: number }): Promise<{ id: string; token: string; expiresAt: string }> {
  const db = createDatabase();
  const days = (SHARE_DAYS as readonly number[]).includes(input.days ?? 30) ? (input.days ?? 30) : 30;
  const active = await db.select({ id: passportShares.id }).from(passportShares).where(and(eq(passportShares.userId, userId), isNull(passportShares.revokedAt), gt(passportShares.expiresAt, new Date())));
  if (active.length >= MAX_ACTIVE) throw new CaptureError(409, "You have ten active links. Revoke one you no longer need, then try again.");
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + days * 86_400_000);
  const include: ShareOptions = { ...DEFAULT_SHARE, ...input.include };
  const id = crypto.randomUUID();
  await db.insert(passportShares).values({ id, userId, tokenHash: hash(token), label: (input.label ?? "").trim().slice(0, 120), include: { ...include }, expiresAt });
  return { id, token, expiresAt: expiresAt.toISOString() };
}

export async function listShares(userId: string): Promise<ShareSummary[]> {
  const rows = await createDatabase().select().from(passportShares).where(eq(passportShares.userId, userId)).orderBy(desc(passportShares.createdAt)).limit(50);
  const now = Date.now();
  return rows.map((row) => ({ id: row.id, label: row.label, include: asOptions(row.include), expiresAt: row.expiresAt.toISOString(), revokedAt: row.revokedAt?.toISOString() ?? null, views: row.views, lastViewedAt: row.lastViewedAt?.toISOString() ?? null, createdAt: row.createdAt.toISOString(), active: !row.revokedAt && row.expiresAt.getTime() > now }));
}

export async function revokeShare(userId: string, id: string): Promise<{ revoked: boolean }> {
  await createDatabase().update(passportShares).set({ revokedAt: new Date() }).where(and(eq(passportShares.id, id), eq(passportShares.userId, userId), isNull(passportShares.revokedAt)));
  return { revoked: true };
}

/** What a person with a link sees: nothing if the link is wrong, expired or revoked, otherwise the passport as the owner chose to show it. */
export async function resolveShare(token: string, ip: string): Promise<{ passport: Passport; expiresAt: string } | null> {
  if (!TOKEN.test(token) || !allow(`share:${ip}`, 60)) return null;
  const db = createDatabase();
  const [row] = await db.select().from(passportShares).where(eq(passportShares.tokenHash, hash(token))).limit(1);
  if (!row || row.revokedAt || row.expiresAt.getTime() <= Date.now()) return null;
  await db.update(passportShares).set({ views: row.views + 1, lastViewedAt: new Date() }).where(eq(passportShares.id, row.id));
  return { passport: applyPrivacy(await buildPassport(row.userId), asOptions(row.include)), expiresAt: row.expiresAt.toISOString() };
}
