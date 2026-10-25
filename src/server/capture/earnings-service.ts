import "server-only";

import { createHash } from "node:crypto";

import { and, desc, eq, gte, inArray, lt } from "drizzle-orm";

import { calculateAllocations, canonicalJson, type AllocationRun, type LearningEvent, type LessonInfo, type Rating, type Receipt } from "@/features/capture/earnings/calculator";
import { draftPolicyTemplate, revenuePolicySchema, type RevenuePolicy } from "@/features/capture/earnings/policy";
import { kcContributors, kcFeedback, kcLearningEvents, kcLessonAttribution, kcLessons, kcProjects, kcReceipts, kcRevenuePolicies, kcStatements } from "@/server/db/schema";

import { usageByLesson } from "./learner-service";
import { CaptureError, audit, database, iso, rolesOf, type Executor } from "./shared";

async function requireAdmin(executor: Executor, userId: string): Promise<void> {
  if (!(await rolesOf(executor, userId)).has("admin")) throw new CaptureError(403, "Only an admin can manage earnings rules.");
}

export type PolicyRecord = { id: string; version: string; status: "draft" | "approved" | "retired"; definition: RevenuePolicy; approvedAt: string | null; approvedBy: string | null; createdAt: string };

function toPolicy(row: typeof kcRevenuePolicies.$inferSelect): PolicyRecord {
  return { id: row.id, version: row.version, status: row.status, definition: row.definition as unknown as RevenuePolicy, approvedAt: row.approvedAt ? iso(row.approvedAt) : null, approvedBy: row.approvedBy, createdAt: iso(row.createdAt) };
}

export async function listPolicies(userId: string): Promise<{ policies: PolicyRecord[]; template: RevenuePolicy }> {
  const db = await database();
  await requireAdmin(db, userId);
  const rows = await db.select().from(kcRevenuePolicies).orderBy(desc(kcRevenuePolicies.createdAt));
  return { policies: rows.map(toPolicy), template: draftPolicyTemplate() };
}

/** Saves a draft policy. Approved policies are never edited: a change is a new version, so old statements still read correctly. */
export async function saveDraftPolicy(userId: string, definition: unknown): Promise<PolicyRecord> {
  const db = await database();
  await requireAdmin(db, userId);
  const parsed = revenuePolicySchema.safeParse(definition);
  if (!parsed.success) throw new CaptureError(422, parsed.error.issues.map((issue) => `${issue.path.join(".") || "policy"}: ${issue.message}`).join(" "));
  const policy = parsed.data;
  const [existing] = await db.select().from(kcRevenuePolicies).where(eq(kcRevenuePolicies.version, policy.version));
  if (existing && existing.status !== "draft") throw new CaptureError(409, `Version ${policy.version} is ${existing.status} and cannot be changed. Save it as a new version.`);
  if (existing) await db.update(kcRevenuePolicies).set({ definition: policy as unknown as Record<string, unknown> }).where(eq(kcRevenuePolicies.id, existing.id));
  else await db.insert(kcRevenuePolicies).values({ version: policy.version, definition: policy as unknown as Record<string, unknown>, createdBy: userId });
  await audit(db, userId, "policy.save", "policy", existing?.id ?? null, { version: policy.version });
  const [row] = await db.select().from(kcRevenuePolicies).where(eq(kcRevenuePolicies.version, policy.version));
  return toPolicy(row);
}

export async function approvePolicy(userId: string, policyId: string): Promise<PolicyRecord> {
  const db = await database();
  await requireAdmin(db, userId);
  const [row] = await db.select().from(kcRevenuePolicies).where(eq(kcRevenuePolicies.id, policyId));
  if (!row) throw new CaptureError(404, "That policy was not found.");
  if (row.status !== "draft") throw new CaptureError(409, "Only a draft policy can be approved.");
  const policy = revenuePolicySchema.parse(row.definition);
  if (policy.contributorPoolBp <= 0) throw new CaptureError(422, "A policy that shares nothing with contributors cannot be approved. Set the contributor pool first.");
  await db.update(kcRevenuePolicies).set({ status: "approved", approvedBy: userId, approvedAt: new Date() }).where(eq(kcRevenuePolicies.id, policyId));
  await audit(db, userId, "policy.approve", "policy", policyId, { version: policy.version, pool: policy.contributorPoolBp });
  const [fresh] = await db.select().from(kcRevenuePolicies).where(eq(kcRevenuePolicies.id, policyId));
  return toPolicy(fresh);
}

export type ReceiptInput = { externalRef: string; grossMinor: number; refundMinor?: number; feeMinor?: number; taxMinor?: number; currency: string; receivedAt: string; status?: Receipt["status"] };

export async function recordReceipt(userId: string, input: ReceiptInput): Promise<void> {
  const db = await database();
  await requireAdmin(db, userId);
  const whole = (value: number | undefined, label: string) => {
    if (value === undefined) return 0;
    if (!Number.isInteger(value) || value < 0) throw new CaptureError(400, `${label} must be a whole number of minor units (paise or cents), zero or more.`);
    return value;
  };
  if (!input.externalRef.trim()) throw new CaptureError(400, "Give the receipt a reference so it cannot be counted twice.");
  const receivedAt = new Date(input.receivedAt);
  if (Number.isNaN(receivedAt.getTime())) throw new CaptureError(400, "The receipt date is not valid.");
  await db
    .insert(kcReceipts)
    .values({ externalRef: input.externalRef.trim().slice(0, 120), grossMinor: whole(input.grossMinor, "Gross"), refundMinor: whole(input.refundMinor, "Refund"), feeMinor: whole(input.feeMinor, "Fee"), taxMinor: whole(input.taxMinor, "Tax"), currency: input.currency.toUpperCase().slice(0, 3), status: input.status ?? "eligible", receivedAt, recordedBy: userId })
    .onDuplicateKeyUpdate({ set: { refundMinor: whole(input.refundMinor, "Refund"), feeMinor: whole(input.feeMinor, "Fee"), taxMinor: whole(input.taxMinor, "Tax"), status: input.status ?? "eligible" } });
  await audit(db, userId, "receipt.record", "receipt", null, { ref: input.externalRef });
}

export async function listReceipts(userId: string) {
  const db = await database();
  await requireAdmin(db, userId);
  const rows = await db.select().from(kcReceipts).orderBy(desc(kcReceipts.receivedAt)).limit(200);
  return rows.map((row) => ({ id: row.id, externalRef: row.externalRef, grossMinor: row.grossMinor, refundMinor: row.refundMinor, feeMinor: row.feeMinor, taxMinor: row.taxMinor, currency: row.currency, status: row.status, receivedAt: iso(row.receivedAt) }));
}

export type RunResult = { run: AllocationRun; statements: Array<{ id: string; contributorId: string; status: string; totalMinor: number }>; inputsHash: string };

/**
 * Applies a policy to a period. The result is stored per contributor with the full inputs fingerprint, so the same run can
 * be reproduced and audited. With an unapproved policy the statements are `illustrative` and cannot be finalised or paid.
 */
export async function runAllocation(userId: string, input: { policyId: string; periodStart: string; periodEnd: string }): Promise<RunResult> {
  const db = await database();
  await requireAdmin(db, userId);
  // Periods are kept to the whole second, which is all the database stores, so a statement is always found again.
  const wholeSecond = (value: string) => new Date(Math.floor(new Date(value).getTime() / 1000) * 1000);
  const start = wholeSecond(input.periodStart);
  const end = wholeSecond(input.periodEnd);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) throw new CaptureError(400, "Choose a period that ends after it starts.");
  const [policyRow] = await db.select().from(kcRevenuePolicies).where(eq(kcRevenuePolicies.id, input.policyId));
  if (!policyRow) throw new CaptureError(404, "That policy was not found.");
  const policy = revenuePolicySchema.parse(policyRow.definition);

  const receiptRows = await db.select().from(kcReceipts).where(and(gte(kcReceipts.receivedAt, start), lt(kcReceipts.receivedAt, end)));
  const receipts: Receipt[] = receiptRows.map((row) => ({ id: row.id, grossMinor: row.grossMinor, refundMinor: row.refundMinor, feeMinor: row.feeMinor, taxMinor: row.taxMinor, currency: row.currency, receivedAt: iso(row.receivedAt), status: row.status }));
  const lessonRows = await db.select().from(kcLessons).where(inArray(kcLessons.status, ["published", "retired"]));
  const attributionRows = lessonRows.length ? await db.select().from(kcLessonAttribution).where(inArray(kcLessonAttribution.lessonId, lessonRows.map((l) => l.id))) : [];
  const lessons: LessonInfo[] = lessonRows.map((row) => ({ id: row.id, title: row.title, version: row.version, attribution: attributionRows.filter((a) => a.lessonId === row.id).map((a) => ({ contributorId: a.contributorId, shareBp: a.shareBp })) })).filter((lesson) => lesson.attribution.length > 0);
  const eventRows = lessons.length ? await db.select().from(kcLearningEvents).where(and(inArray(kcLearningEvents.lessonId, lessons.map((l) => l.id)), gte(kcLearningEvents.occurredAt, start), lt(kcLearningEvents.occurredAt, end))) : [];
  const events: LearningEvent[] = eventRows.map((row) => ({ id: row.id, lessonId: row.lessonId, learnerRef: row.learnerRef, type: row.eventType, seconds: row.seconds, occurredAt: iso(row.occurredAt) }));
  const feedbackRows = lessons.length ? await db.select().from(kcFeedback).where(and(inArray(kcFeedback.lessonId, lessons.map((l) => l.id)), inArray(kcFeedback.moderation, ["visible", "held"]))) : [];
  const ratings: Rating[] = feedbackRows.map((row) => ({ lessonId: row.lessonId, learnerRef: row.learnerRef, rating: row.rating, occurredAt: iso(row.updatedAt) }));

  const run = calculateAllocations({ policy, policyApproved: policyRow.status === "approved", period: { start: start.toISOString(), end: end.toISOString() }, receipts, events, ratings, lessons });
  const inputsHash = createHash("sha256").update(canonicalJson({ run, policy })).digest("hex");

  const statements: RunResult["statements"] = [];
  await db.transaction(async (tx) => {
    for (const contributor of run.contributors) {
      const payload = { policyVersion: run.policyVersion, policyApproved: run.policyApproved, currency: run.currency, period: run.period, inputs: run.inputs, appliedWeights: run.appliedWeights, notes: run.notes, payableAfter: run.payableAfter, contributor, lessons: run.lessons.filter((lesson) => contributor.lines.some((line) => line.lessonId === lesson.lessonId)), payable: contributor.payable };
      await tx
        .insert(kcStatements)
        .values({ contributorId: contributor.contributorId, policyId: policyRow.id, periodStart: start, periodEnd: end, status: run.status, currency: run.currency, totalMinor: contributor.totalMinor, payload: payload as unknown as Record<string, unknown>, inputsHash, createdBy: userId })
        .onDuplicateKeyUpdate({ set: { inputsHash } });
      const [saved] = await tx.select().from(kcStatements).where(and(eq(kcStatements.contributorId, contributor.contributorId), eq(kcStatements.policyId, policyRow.id), eq(kcStatements.periodStart, start), eq(kcStatements.periodEnd, end), eq(kcStatements.inputsHash, inputsHash)));
      statements.push({ id: saved.id, contributorId: saved.contributorId, status: saved.status, totalMinor: saved.totalMinor });
    }
    await audit(tx, userId, "allocation.run", "policy", policyRow.id, { period: run.period, inputsHash, status: run.status, contributors: run.contributors.length });
  });
  return { run, statements, inputsHash };
}

export async function finalizeStatement(userId: string, statementId: string, action: "final" | "paid" | "void"): Promise<void> {
  const db = await database();
  await requireAdmin(db, userId);
  const [row] = await db.select().from(kcStatements).where(eq(kcStatements.id, statementId));
  if (!row) throw new CaptureError(404, "That statement was not found.");
  const [policy] = await db.select().from(kcRevenuePolicies).where(eq(kcRevenuePolicies.id, row.policyId));
  if (action === "final") {
    if (row.status !== "draft") throw new CaptureError(409, row.status === "illustrative" ? "An illustrative statement is a preview and cannot be finalised. Approve the policy and run it again." : `A ${row.status} statement cannot be finalised.`);
    if (policy.status !== "approved") throw new CaptureError(409, "The policy is not approved.");
  }
  if (action === "paid" && row.status !== "final") throw new CaptureError(409, "Only a final statement can be marked paid.");
  if (action === "void" && row.status === "paid") throw new CaptureError(409, "A paid statement cannot be voided.");
  await db.update(kcStatements).set({ status: action, ...(action === "final" ? { finalizedAt: new Date() } : {}) }).where(eq(kcStatements.id, statementId));
  await audit(db, userId, `statement.${action}`, "statement", statementId);
}

export async function disputeStatement(userId: string, statementId: string, note: string): Promise<void> {
  const db = await database();
  const [row] = await db.select().from(kcStatements).where(and(eq(kcStatements.id, statementId), eq(kcStatements.contributorId, userId)));
  if (!row) throw new CaptureError(404, "That statement was not found.");
  if (row.status === "illustrative" || row.status === "void") throw new CaptureError(409, "This statement is only a preview and cannot be disputed.");
  if (row.status === "paid") throw new CaptureError(409, "This statement was paid. Contact support to raise an adjustment.");
  const [policy] = await db.select().from(kcRevenuePolicies).where(eq(kcRevenuePolicies.id, row.policyId));
  const windowDays = revenuePolicySchema.parse(policy.definition).payout.disputeWindowDays;
  const since = (row.finalizedAt ?? row.createdAt).getTime();
  if (Date.now() - since > windowDays * 86_400_000) throw new CaptureError(409, `The ${windowDays} day dispute window for this statement has closed.`);
  if (note.trim().length < 10) throw new CaptureError(400, "Please explain what looks wrong (at least a sentence).");
  await db.update(kcStatements).set({ status: "disputed", disputeNote: note.trim().slice(0, 1500) }).where(eq(kcStatements.id, statementId));
  await audit(db, userId, "statement.dispute", "statement", statementId);
}

export type DashboardLesson = {
  id: string;
  slug: string;
  title: string;
  status: string;
  shareBp: number;
  version: number;
  usage: { starts: number; learners: number; completions: number; seconds: number; materialUses: number; ratings: number; meanRating: number | null };
};

export async function contributorDashboard(userId: string) {
  const db = await database();
  const [contributor] = await db.select().from(kcContributors).where(eq(kcContributors.userId, userId));
  const projects = await db.select().from(kcProjects).where(eq(kcProjects.contributorId, userId)).orderBy(desc(kcProjects.updatedAt));
  const credited = await db.select().from(kcLessonAttribution).where(eq(kcLessonAttribution.contributorId, userId));
  const lessonRows = credited.length ? await db.select().from(kcLessons).where(inArray(kcLessons.id, credited.map((row) => row.lessonId))) : [];
  const usage = await usageByLesson(lessonRows.map((row) => row.id));
  const lessons: DashboardLesson[] = lessonRows.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    status: row.status,
    version: row.version,
    shareBp: credited.find((c) => c.lessonId === row.id)?.shareBp ?? 0,
    usage: usage.get(row.id)!,
  }));
  const statements = await db.select().from(kcStatements).where(eq(kcStatements.contributorId, userId)).orderBy(desc(kcStatements.createdAt));
  const [approvedPolicy] = await db.select().from(kcRevenuePolicies).where(eq(kcRevenuePolicies.status, "approved")).orderBy(desc(kcRevenuePolicies.approvedAt)).limit(1);
  return {
    contributor: contributor ? { name: contributor.publicName, headline: contributor.headline, status: contributor.status } : null,
    projects: projects.map((project) => ({ id: project.id, title: project.title, status: project.status, updatedAt: iso(project.updatedAt) })),
    lessons,
    statements: statements.map((row) => ({ id: row.id, status: row.status, totalMinor: row.totalMinor, currency: row.currency, periodStart: iso(row.periodStart), periodEnd: iso(row.periodEnd), policyId: row.policyId, payload: row.payload, disputeNote: row.disputeNote, createdAt: iso(row.createdAt) })),
    earningsPolicy: approvedPolicy ? { version: approvedPolicy.version, approvedAt: iso(approvedPolicy.approvedAt) } : null,
  };
}
