import "server-only";

import { and, asc, eq, inArray, notInArray } from "drizzle-orm";

import { CaptureError, audit, database, iso, rolesOf, type Executor } from "@/server/capture/shared";
import { finalizeStatement } from "@/server/capture/earnings-service";
import { kcContributors, kcStatements, payouts, users } from "@/server/db/schema";

async function requireAdmin(executor: Executor, userId: string): Promise<void> {
  if (!(await rolesOf(executor, userId)).has("admin")) throw new CaptureError(403, "Only an admin can manage payouts.");
}

/**
 * Coach payouts. The provider today is a manual bank transfer: FutureSkilz works out who is owed what from final statements and
 * produces a file for the finance team, who pay from the company's bank, and an admin then records the bank reference here, which
 * marks the statement paid. Bank details are never stored in FutureSkilz. A payout API (Razorpay X) can replace the manual step
 * later without changing statements or this table.
 */
export type PayoutRow = { id: string; statementId: string; coach: string; email: string; amountMinor: number; currency: string; status: "queued" | "paid" | "failed"; reference: string | null; paidAt: string | null; createdAt: string };

const csvCell = (value: string | number): string => {
  const text = String(value);
  // A spreadsheet runs a cell that starts with these as a formula: a coach's name must not be able to do that.
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[",\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
};

async function rows(db: Executor, status?: PayoutRow["status"]): Promise<PayoutRow[]> {
  const list = await db.select({ p: payouts, name: kcContributors.publicName, email: users.email }).from(payouts).innerJoin(users, eq(users.id, payouts.contributorId)).leftJoin(kcContributors, eq(kcContributors.userId, payouts.contributorId)).where(status ? eq(payouts.status, status) : undefined).orderBy(asc(payouts.createdAt)).limit(500);
  return list.map(({ p, name, email }) => ({ id: p.id, statementId: p.statementId, coach: name ?? email, email, amountMinor: p.amountMinor, currency: p.currency, status: p.status, reference: p.reference, paidAt: p.paidAt ? iso(p.paidAt) : null, createdAt: iso(p.createdAt) }));
}

export async function listPayouts(userId: string): Promise<PayoutRow[]> {
  const db = await database();
  await requireAdmin(db, userId);
  return rows(db);
}

/** Queues a payout for every final statement that has none yet. Safe to run again. */
export async function queuePayouts(userId: string): Promise<{ queued: number }> {
  const db = await database();
  await requireAdmin(db, userId);
  const existing = await db.select({ id: payouts.statementId }).from(payouts);
  const finals = await db.select().from(kcStatements).where(and(eq(kcStatements.status, "final"), existing.length ? notInArray(kcStatements.id, existing.map((row) => row.id)) : undefined));
  let queued = 0;
  for (const statement of finals) {
    if (statement.totalMinor <= 0) continue;
    await db.insert(payouts).values({ statementId: statement.id, contributorId: statement.contributorId, amountMinor: statement.totalMinor, currency: statement.currency, createdBy: userId }).onDuplicateKeyUpdate({ set: { statementId: statement.id } });
    queued += 1;
  }
  await audit(db, userId, "payout.queue", "payout", null, { queued });
  return { queued };
}

/** The file the finance team pays from. Contains names, emails and amounts, never bank details. */
export async function payoutsCsv(userId: string): Promise<string> {
  const db = await database();
  await requireAdmin(db, userId);
  const queued = await rows(db, "queued");
  const header = ["payout_id", "statement_id", "coach", "email", "amount", "currency"];
  const lines = queued.map((row) => [row.id, row.statementId, row.coach, row.email, (row.amountMinor / 100).toFixed(2), row.currency].map(csvCell).join(","));
  await audit(db, userId, "payout.export", "payout", null, { rows: queued.length });
  return [header.join(","), ...lines].join("\n");
}

/** Records that a payout was made, with the bank's reference, and marks its statement paid. */
export async function markPayoutPaid(userId: string, payoutId: string, reference: string): Promise<PayoutRow> {
  const db = await database();
  await requireAdmin(db, userId);
  const clean = reference.trim().slice(0, 120);
  if (clean.length < 4) throw new CaptureError(400, "Enter the bank transfer reference so the payment can be traced.");
  const [row] = await db.select().from(payouts).where(eq(payouts.id, payoutId)).limit(1);
  if (!row) throw new CaptureError(404, "That payout was not found.");
  if (row.status !== "queued") throw new CaptureError(409, "This payout was already settled.");
  await finalizeStatement(userId, row.statementId, "paid");
  await db.update(payouts).set({ status: "paid", reference: clean, paidAt: new Date() }).where(and(eq(payouts.id, payoutId), inArray(payouts.status, ["queued"])));
  await audit(db, userId, "payout.paid", "payout", payoutId, { reference: clean });
  return (await rows(db)).find((item) => item.id === payoutId)!;
}
