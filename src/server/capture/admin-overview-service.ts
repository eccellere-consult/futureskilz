import "server-only";

import { desc, eq, sql } from "drizzle-orm";

import { kcAudit, kcContributors, kcLessons, kcProjects, kcReceipts, kcRevenuePolicies, kcStatements, userRoles, users } from "@/server/db/schema";

import { CaptureError, database, iso, rolesOf, type Executor } from "./shared";

async function requireAdmin(executor: Executor, userId: string): Promise<void> {
  if (!(await rolesOf(executor, userId)).has("admin")) throw new CaptureError(403, "This is for admins only.");
}

const tally = <T extends string>(rows: Array<{ key: T; n: number | string }>): Record<string, number> => Object.fromEntries(rows.map((row) => [row.key, Number(row.n)]));

/** The numbers an admin needs at a glance: people, content waiting, and money. No personal details beyond names in the audit trail. */
export async function adminOverview(userId: string) {
  const db = await database();
  await requireAdmin(db, userId);
  const [people] = await db.select({ n: sql<number>`count(*)` }).from(users);
  const roles = await db.select({ key: userRoles.role, n: sql<number>`count(*)` }).from(userRoles).groupBy(userRoles.role);
  const suspended = await db.select({ n: sql<number>`count(*)` }).from(users).where(eq(users.status, "suspended"));
  const [coaches] = await db.select({ n: sql<number>`count(*)` }).from(kcContributors);
  const projects = await db.select({ key: kcProjects.status, n: sql<number>`count(*)` }).from(kcProjects).groupBy(kcProjects.status);
  const lessons = await db.select({ key: kcLessons.status, n: sql<number>`count(*)` }).from(kcLessons).groupBy(kcLessons.status);
  const receipts = await db
    .select({ currency: kcReceipts.currency, n: sql<number>`count(*)`, gross: sql<number>`coalesce(sum(${kcReceipts.grossMinor}),0)`, refunds: sql<number>`coalesce(sum(${kcReceipts.refundMinor}),0)` })
    .from(kcReceipts)
    .groupBy(kcReceipts.currency);
  const statements = await db
    .select({ key: kcStatements.status, n: sql<number>`count(*)`, total: sql<number>`coalesce(sum(${kcStatements.totalMinor}),0)` })
    .from(kcStatements)
    .groupBy(kcStatements.status);
  const policies = await db.select({ key: kcRevenuePolicies.status, n: sql<number>`count(*)` }).from(kcRevenuePolicies).groupBy(kcRevenuePolicies.status);
  const recent = await db.select().from(kcAudit).orderBy(desc(kcAudit.createdAt)).limit(8);
  const roleCounts = tally(roles);
  return {
    people: { total: Number(people?.n ?? 0), coaches: Number(coaches?.n ?? 0), editors: roleCounts.editor ?? 0, admins: roleCounts.admin ?? 0, suspended: Number(suspended[0]?.n ?? 0) },
    projects: tally(projects),
    lessons: tally(lessons),
    policies: tally(policies),
    receipts: receipts.map((row) => ({ currency: row.currency, count: Number(row.n), grossMinor: Number(row.gross), refundMinor: Number(row.refunds) })),
    statements: statements.map((row) => ({ status: row.key, count: Number(row.n), totalMinor: Number(row.total) })),
    recent: recent.map((row) => ({ id: row.id, action: row.action, entity: row.entity, at: iso(row.createdAt) })),
  };
}

export type AdminOverview = Awaited<ReturnType<typeof adminOverview>>;

/** Every statement with the coach's name: what is owed, what is paid, what is disputed. */
export async function listStatements(userId: string) {
  const db = await database();
  await requireAdmin(db, userId);
  const rows = await db
    .select({ id: kcStatements.id, status: kcStatements.status, totalMinor: kcStatements.totalMinor, currency: kcStatements.currency, periodStart: kcStatements.periodStart, periodEnd: kcStatements.periodEnd, disputeNote: kcStatements.disputeNote, createdAt: kcStatements.createdAt, coach: kcContributors.publicName, version: kcRevenuePolicies.version, approved: kcRevenuePolicies.status })
    .from(kcStatements)
    .leftJoin(kcContributors, eq(kcContributors.userId, kcStatements.contributorId))
    .leftJoin(kcRevenuePolicies, eq(kcRevenuePolicies.id, kcStatements.policyId))
    .orderBy(desc(kcStatements.createdAt))
    .limit(200);
  return rows.map((row) => ({ id: row.id, status: row.status, totalMinor: row.totalMinor, currency: row.currency, periodStart: iso(row.periodStart), periodEnd: iso(row.periodEnd), disputeNote: row.disputeNote, coach: row.coach ?? "Unknown coach", policyVersion: row.version ?? "", policyApproved: row.approved === "approved" }));
}
