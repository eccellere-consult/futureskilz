import "server-only";

import { and, asc, desc, eq, gt, sql } from "drizzle-orm";
import { z } from "zod";

import { skillShots as legacySkillShots } from "@/features/journey/model";
import { PILLAR_SKILLS } from "@/features/pathway/estimate";
import { designedSkillShots } from "@/features/skillshot";
import { decideAccess, FREE_PER_PILLAR, type Access, type CatalogItem } from "@/features/payments/access";
import { financialYear, invoiceNumber, isStateCode, nextSequence, splitTaxInclusive } from "@/features/payments/gst";
import { applyDiscount, MIN_CHARGE_MINOR } from "@/features/payments/pricing";
import { extraFreePerPillar, liveDiscountByCode, redeemCampaign } from "@/server/capture/campaign-service";
import { CaptureError, audit, database, iso, rolesOf, type Executor } from "@/server/capture/shared";
import { entitlements, invoices, kcReceipts, orders, paymentEvents, plans, skillShotDrafts, users } from "@/server/db/schema";
import { getServerEnvironment } from "@/server/env";

import { getPaymentProvider, TestPaymentProvider } from "./provider";

async function requireAdmin(executor: Executor, userId: string): Promise<void> {
  if (!(await rolesOf(executor, userId)).has("admin")) throw new CaptureError(403, "Only an admin can manage plans and payments.");
}

// ---- Plans ---------------------------------------------------------------------------------------------------------

export const planSchema = z.object({
  code: z.string().trim().toLowerCase().regex(/^[a-z0-9-]{3,40}$/, "A code is 3 to 40 lowercase letters, numbers or dashes."),
  name: z.string().trim().min(3).max(120),
  description: z.string().trim().max(400).default(""),
  amountMinor: z.number().int().min(MIN_CHARGE_MINOR).max(100_000_000),
  durationDays: z.number().int().min(1).max(3650),
  sortOrder: z.number().int().min(0).max(1000).default(0),
});

export type PlanRow = { id: string; code: string; name: string; description: string; amountMinor: number; currency: string; durationDays: number; active: boolean };
const toPlan = (row: typeof plans.$inferSelect): PlanRow => ({ id: row.id, code: row.code, name: row.name, description: row.description, amountMinor: row.amountMinor, currency: row.currency, durationDays: row.durationDays, active: row.active });

export async function listAllPlans(userId: string): Promise<PlanRow[]> {
  const db = await database();
  await requireAdmin(db, userId);
  return (await db.select().from(plans).orderBy(asc(plans.sortOrder), asc(plans.name))).map(toPlan);
}

/** Saves a plan. A plan is created switched off; an admin puts it on sale. Prices of a plan that has been sold are not edited: make a new plan. */
export async function savePlan(userId: string, raw: unknown): Promise<PlanRow> {
  const db = await database();
  await requireAdmin(db, userId);
  const parsed = planSchema.safeParse(raw);
  if (!parsed.success) throw new CaptureError(422, parsed.error.issues[0]?.message ?? "Check the plan details.");
  const v = parsed.data;
  const [existing] = await db.select().from(plans).where(eq(plans.code, v.code)).limit(1);
  if (existing) {
    const [sold] = await db.select({ id: orders.id }).from(orders).where(eq(orders.planId, existing.id)).limit(1);
    if (sold && (existing.amountMinor !== v.amountMinor || existing.durationDays !== v.durationDays)) throw new CaptureError(409, "This plan has been sold, so its price and length cannot change. Create a new plan and switch this one off.");
    await db.update(plans).set({ name: v.name, description: v.description, amountMinor: v.amountMinor, durationDays: v.durationDays, sortOrder: v.sortOrder }).where(eq(plans.id, existing.id));
  } else await db.insert(plans).values({ code: v.code, name: v.name, description: v.description, amountMinor: v.amountMinor, durationDays: v.durationDays, sortOrder: v.sortOrder, currency: "INR", active: false });
  await audit(db, userId, "plan.save", "plan", existing?.id ?? null, { code: v.code });
  const [row] = await db.select().from(plans).where(eq(plans.code, v.code));
  return toPlan(row);
}

export async function setPlanActive(userId: string, id: string, active: boolean): Promise<PlanRow> {
  const db = await database();
  await requireAdmin(db, userId);
  const [row] = await db.select().from(plans).where(eq(plans.id, id)).limit(1);
  if (!row) throw new CaptureError(404, "That plan was not found.");
  await db.update(plans).set({ active }).where(eq(plans.id, id));
  await audit(db, userId, active ? "plan.on_sale" : "plan.off_sale", "plan", id);
  const [fresh] = await db.select().from(plans).where(eq(plans.id, id));
  return toPlan(fresh);
}

// ---- Access --------------------------------------------------------------------------------------------------------

/** Payments are live only when a gateway is connected and something is on sale. Until then nothing is locked. */
export async function paymentsLive(executor?: Executor): Promise<boolean> {
  if (!getPaymentProvider()) return false;
  const db = executor ?? (await database());
  const [row] = await db.select({ id: plans.id }).from(plans).where(eq(plans.active, true)).limit(1);
  return Boolean(row);
}

export async function hasActivePass(userId: string | null | undefined, executor?: Executor): Promise<boolean> {
  if (!userId) return false;
  const db = executor ?? (await database());
  const [row] = await db.select({ id: entitlements.id }).from(entitlements).where(and(eq(entitlements.userId, userId), eq(entitlements.status, "active"), gt(entitlements.endsAt, new Date()))).limit(1);
  return Boolean(row);
}

const skillToPillar = new Map(Object.entries(PILLAR_SKILLS).flatMap(([pillar, list]) => list.map((skill) => [skill, pillar] as const)));

/** The Skill Shots on offer in a fixed order: the original five, the built-in designed ones, then published ones by date. */
export async function skillShotCatalog(executor?: Executor): Promise<CatalogItem[]> {
  const db = executor ?? (await database());
  const published = await db.select({ slug: skillShotDrafts.slug, blueprint: skillShotDrafts.blueprint }).from(skillShotDrafts).where(eq(skillShotDrafts.status, "published")).orderBy(asc(skillShotDrafts.updatedAt));
  const pillarOf = (skillMap: Array<{ skill: string }> | undefined) => skillMap?.map((entry) => skillToPillar.get(entry.skill)).find(Boolean) ?? null;
  const catalog: CatalogItem[] = [
    ...legacySkillShots.map((item) => ({ slug: item.slug, pillarId: item.pillarId as string })),
    ...designedSkillShots.map((item) => ({ slug: item.meta.id, pillarId: pillarOf(item.meta.skillMap) })),
    ...published.map((row) => ({ slug: row.slug, pillarId: pillarOf((row.blueprint as { meta?: { skillMap?: Array<{ skill: string }> } })?.meta?.skillMap) })),
  ];
  return catalog.filter((item, index) => catalog.findIndex((other) => other.slug === item.slug) === index);
}

/** Whether this learner may open this Skill Shot. A failure of the check never locks anyone out. */
export async function skillShotAccess(userId: string | null | undefined, slug: string): Promise<Access> {
  try {
    const db = await database();
    const enforced = await paymentsLive(db);
    if (!enforced) return { allowed: true, reason: "not-enforced" };
    return decideAccess({ slug, catalog: await skillShotCatalog(db), perPillar: FREE_PER_PILLAR + (await extraFreePerPillar(db)), hasPass: await hasActivePass(userId, db), enforced });
  } catch (error) {
    console.error("[access]", error instanceof Error ? error.message : error);
    return { allowed: true, reason: "not-enforced" };
  }
}

// ---- Billing view --------------------------------------------------------------------------------------------------

export type BillingView = {
  live: boolean;
  mode: "off" | "test" | "razorpay";
  freePerPillar: number;
  plans: PlanRow[];
  pass: { endsAt: string; planName: string } | null;
  invoices: Array<{ id: string; number: string; issuedAt: string; totalMinor: number; currency: string; description: string }>;
};

export async function billingView(userId: string): Promise<BillingView> {
  const db = await database();
  const env = getServerEnvironment();
  const sale = await db.select().from(plans).where(eq(plans.active, true)).orderBy(asc(plans.sortOrder), asc(plans.amountMinor));
  const [pass] = await db.select({ endsAt: entitlements.endsAt, planId: entitlements.planId }).from(entitlements).where(and(eq(entitlements.userId, userId), eq(entitlements.status, "active"), gt(entitlements.endsAt, new Date()))).orderBy(desc(entitlements.endsAt)).limit(1);
  const [passPlan] = pass ? await db.select({ name: plans.name }).from(plans).where(eq(plans.id, pass.planId)) : [];
  const mine = await db.select({ id: invoices.id, number: invoices.number, issuedAt: invoices.issuedAt, totalMinor: invoices.totalMinor, currency: invoices.currency, description: invoices.description }).from(invoices).innerJoin(orders, eq(orders.id, invoices.orderId)).where(eq(orders.userId, userId)).orderBy(desc(invoices.issuedAt)).limit(50);
  return {
    live: await paymentsLive(db),
    mode: env.PAYMENTS_MODE,
    freePerPillar: FREE_PER_PILLAR + (await extraFreePerPillar(db)),
    plans: sale.map(toPlan),
    pass: pass ? { endsAt: iso(pass.endsAt), planName: passPlan?.name ?? "Pass" } : null,
    invoices: mine.map((row) => ({ ...row, issuedAt: iso(row.issuedAt) })),
  };
}

// ---- Checkout ------------------------------------------------------------------------------------------------------

export type Checkout = { orderId: string; provider: "razorpay" | "test"; providerOrderId: string; keyId: string | null; amountMinor: number; currency: string; planName: string; discountMinor: number; prefill: { name: string; email: string } };

export async function startCheckout(userId: string, input: { planId: string; state: string; gstin?: string; code?: string }): Promise<Checkout> {
  const provider = getPaymentProvider();
  if (!provider) throw new CaptureError(409, "Payments are not switched on yet.");
  const db = await database();
  const [plan] = await db.select().from(plans).where(and(eq(plans.id, input.planId), eq(plans.active, true))).limit(1);
  if (!plan) throw new CaptureError(404, "That plan is not on sale.");
  if (!isStateCode(input.state)) throw new CaptureError(400, "Choose your state. It decides how GST is shown on your invoice.");
  const gstin = (input.gstin ?? "").trim().toUpperCase();
  if (gstin && !/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin)) throw new CaptureError(400, "That GSTIN does not look right. Leave it blank if you are buying as an individual.");
  let discount = { id: null as string | null, percentOffBp: 0 };
  if (input.code?.trim()) {
    const found = await liveDiscountByCode(input.code, db);
    if (!found) throw new CaptureError(409, "That code is not valid right now.");
    discount = found;
  }
  const price = applyDiscount(plan.amountMinor, discount.percentOffBp);
  if (price.payMinor < MIN_CHARGE_MINOR) throw new CaptureError(409, "That code takes the price below the smallest amount the payment gateway accepts.");
  const [person] = await db.select({ name: users.displayName, email: users.email }).from(users).where(eq(users.id, userId)).limit(1);
  const id = crypto.randomUUID();
  const created = await provider.createOrder({ amountMinor: price.payMinor, currency: plan.currency, receipt: `fs-${id.slice(0, 18)}`, notes: { order: id, plan: plan.code } });
  await db.insert(orders).values({ id, userId, planId: plan.id, campaignId: discount.id, listMinor: price.listMinor, discountMinor: price.discountMinor, amountMinor: price.payMinor, currency: plan.currency, provider: provider.name, providerOrderId: created.providerOrderId, customerState: input.state, customerGstin: gstin || null });
  await audit(db, userId, "order.create", "order", id, { plan: plan.code, amountMinor: price.payMinor });
  return { orderId: id, provider: provider.name, providerOrderId: created.providerOrderId, keyId: created.keyId, amountMinor: price.payMinor, currency: plan.currency, planName: plan.name, discountMinor: price.discountMinor, prefill: { name: person?.name ?? "", email: person?.email ?? "" } };
}

/** The learner's browser reports a payment. It is believed only if the gateway's signature over order and payment checks out. */
export async function confirmPayment(userId: string, input: { providerOrderId: string; paymentId: string; signature: string }): Promise<{ status: "paid" }> {
  const provider = getPaymentProvider();
  if (!provider) throw new CaptureError(409, "Payments are not switched on yet.");
  const db = await database();
  const [order] = await db.select().from(orders).where(and(eq(orders.providerOrderId, input.providerOrderId), eq(orders.userId, userId))).limit(1);
  if (!order) throw new CaptureError(404, "That order was not found.");
  if (order.provider !== provider.name) throw new CaptureError(409, "That order was made with a different payment mode.");
  if (!provider.verifyCheckout({ orderId: input.providerOrderId, paymentId: input.paymentId, signature: input.signature })) throw new CaptureError(400, "The payment could not be verified. If money was taken, it will be matched automatically within minutes.");
  await markPaid(order.id, input.paymentId, {});
  return { status: "paid" };
}

/** Test mode only: pays the order as the learner, with a signature the test provider accepts. Moves no money. */
export async function simulateTestPayment(userId: string, providerOrderId: string): Promise<{ status: "paid" }> {
  if (getServerEnvironment().PAYMENTS_MODE !== "test") throw new CaptureError(403, "Simulated payments are only available in test mode.");
  const paymentId = `test_pay_${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`;
  return confirmPayment(userId, { providerOrderId, paymentId, signature: TestPaymentProvider.sign(providerOrderId, paymentId) });
}

// ---- Settlement (idempotent) ---------------------------------------------------------------------------------------

function supplier(): Record<string, string> {
  const env = getServerEnvironment();
  return { name: env.GST_SUPPLIER_NAME ?? "FutureSkilz", gstin: env.GST_SUPPLIER_GSTIN ?? "", state: env.GST_SUPPLIER_STATE ?? "", address: env.GST_SUPPLIER_ADDRESS ?? "" };
}

/**
 * Marks an order paid exactly once: the invoice, the pass, and the receipt that feeds the revenue ledger are created together or
 * not at all, and a second call for the same order does nothing. A test-mode order makes a held receipt, so it never counts as revenue.
 */
export async function markPaid(orderId: string, paymentId: string, extra: { feeMinor?: number }): Promise<void> {
  const db = await database();
  await db.transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
    if (!order || order.status === "paid" || order.status === "refunded") return;
    const [plan] = await tx.select().from(plans).where(eq(plans.id, order.planId));
    const [person] = await tx.select({ name: users.displayName, email: users.email }).from(users).where(eq(users.id, order.userId));
    const now = new Date();
    const biz = supplier();
    const rateBp = getServerEnvironment().GST_RATE_BP;
    const tax = splitTaxInclusive(order.amountMinor, rateBp, biz.state, order.customerState);
    const fy = financialYear(now);
    const existing = await tx.select({ number: invoices.number }).from(invoices).where(eq(invoices.financialYear, fy)).for("update");
    const number = invoiceNumber(fy, nextSequence(existing.map((row) => row.number), fy));
    await tx.update(orders).set({ status: "paid", providerPaymentId: paymentId, paidAt: now }).where(eq(orders.id, orderId));
    await tx.insert(invoices).values({ orderId, number, financialYear: fy, issuedAt: now, customerName: person?.name ?? "", customerEmail: person?.email ?? "", customerState: order.customerState, customerGstin: order.customerGstin, description: `${plan.name} (${plan.durationDays} days of access)`, rateBp, taxableMinor: tax.taxableMinor, cgstMinor: tax.cgstMinor, sgstMinor: tax.sgstMinor, igstMinor: tax.igstMinor, totalMinor: order.amountMinor, currency: order.currency, supplier: biz });
    // A new pass starts when the current one ends, so buying early loses nothing.
    const [current] = await tx.select({ endsAt: entitlements.endsAt }).from(entitlements).where(and(eq(entitlements.userId, order.userId), eq(entitlements.status, "active"), gt(entitlements.endsAt, now))).orderBy(desc(entitlements.endsAt)).limit(1);
    const startsAt = current?.endsAt ?? now;
    await tx.insert(entitlements).values({ userId: order.userId, orderId, planId: order.planId, startsAt, endsAt: new Date(startsAt.getTime() + plan.durationDays * 86_400_000) });
    const test = order.provider === "test";
    await tx.insert(kcReceipts).values({ externalRef: `${test ? "test-pay" : "pay"}:${paymentId}`, grossMinor: order.amountMinor, feeMinor: extra.feeMinor ?? 0, taxMinor: tax.taxMinor, currency: order.currency, status: test ? "held" : "eligible", receivedAt: now }).onDuplicateKeyUpdate({ set: { feeMinor: extra.feeMinor ?? 0 } });
    if (order.campaignId) await redeemCampaign(order.campaignId, tx);
    await audit(tx, order.userId, "order.paid", "order", orderId, { invoice: number, provider: order.provider });
  });
}

/** A refund (full or partial) reported by the gateway. A full refund ends the pass and marks the receipt refunded. */
export async function applyRefund(providerPaymentId: string, refundedMinor: number): Promise<void> {
  const db = await database();
  await db.transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.providerPaymentId, providerPaymentId)).for("update");
    if (!order || order.status === "created" || order.status === "failed") return;
    const total = Math.min(order.amountMinor, Math.max(order.refundedMinor, refundedMinor));
    const full = total >= order.amountMinor;
    await tx.update(orders).set({ refundedMinor: total, status: full ? "refunded" : order.status }).where(eq(orders.id, order.id));
    if (full) await tx.update(entitlements).set({ status: "revoked" }).where(eq(entitlements.orderId, order.id));
    const ref = `${order.provider === "test" ? "test-pay" : "pay"}:${providerPaymentId}`;
    await tx.update(kcReceipts).set({ refundMinor: total, ...(full ? { status: "refunded" as const } : {}) }).where(eq(kcReceipts.externalRef, ref));
    await audit(tx, order.userId, "order.refund", "order", order.id, { refundedMinor: total, full });
  });
}

// ---- Webhook -------------------------------------------------------------------------------------------------------

type RazorpayEvent = { event?: string; payload?: { payment?: { entity?: { id?: string; order_id?: string; amount?: number; fee?: number } }; refund?: { entity?: { payment_id?: string; amount?: number } } } };

/** Razorpay's notifications. Verified by signature, recorded by event id so a retry does nothing, and always answered quickly. */
export async function handleWebhook(rawBody: string, signature: string, eventId: string): Promise<{ ok: boolean; status: number; outcome: string }> {
  const provider = getPaymentProvider();
  if (!provider || !signature || !provider.verifyWebhook(rawBody, signature)) return { ok: false, status: 400, outcome: "bad signature" };
  let event: RazorpayEvent;
  try { event = JSON.parse(rawBody) as RazorpayEvent; } catch { return { ok: false, status: 400, outcome: "bad body" }; }
  const db = await database();
  const id = eventId || `body:${sqlHash(rawBody)}`;
  try {
    await db.insert(paymentEvents).values({ provider: provider.name, eventId: id.slice(0, 120), type: (event.event ?? "unknown").slice(0, 60) });
  } catch {
    return { ok: true, status: 200, outcome: "duplicate" };
  }
  const payment = event.payload?.payment?.entity;
  let outcome = "ignored";
  if (event.event === "payment.captured" && payment?.order_id && payment.id) {
    const [order] = await db.select().from(orders).where(and(eq(orders.provider, provider.name), eq(orders.providerOrderId, payment.order_id))).limit(1);
    if (!order) outcome = "unknown order";
    else if (payment.amount !== undefined && payment.amount !== order.amountMinor) outcome = "amount mismatch";
    else { await markPaid(order.id, payment.id, { feeMinor: payment.fee ?? 0 }); outcome = "paid"; }
  } else if (event.event === "payment.failed" && payment?.order_id) {
    await db.update(orders).set({ status: "failed" }).where(and(eq(orders.provider, provider.name), eq(orders.providerOrderId, payment.order_id), eq(orders.status, "created")));
    outcome = "failed";
  } else if (event.event === "refund.processed" || event.event === "refund.created") {
    const refund = event.payload?.refund?.entity;
    if (refund?.payment_id && typeof refund.amount === "number") { await applyRefund(refund.payment_id, refund.amount); outcome = "refunded"; }
  }
  await db.update(paymentEvents).set({ outcome }).where(and(eq(paymentEvents.provider, provider.name), eq(paymentEvents.eventId, id.slice(0, 120))));
  return { ok: true, status: 200, outcome };
}

const sqlHash = (value: string): string => { let h = 0; for (let i = 0; i < value.length; i += 1) h = (h * 31 + value.charCodeAt(i)) | 0; return String(h >>> 0); };

// ---- Invoices ------------------------------------------------------------------------------------------------------

export async function invoiceFor(userId: string, invoiceId: string) {
  const db = await database();
  const [row] = await db.select({ invoice: invoices, owner: orders.userId }).from(invoices).innerJoin(orders, eq(orders.id, invoices.orderId)).where(eq(invoices.id, invoiceId)).limit(1);
  if (!row) throw new CaptureError(404, "That invoice was not found.");
  if (row.owner !== userId && !(await rolesOf(db, userId)).has("admin")) throw new CaptureError(404, "That invoice was not found.");
  return row.invoice;
}

export async function paymentsOverview(userId: string) {
  const db = await database();
  await requireAdmin(db, userId);
  const env = getServerEnvironment();
  const [totals] = await db.select({ paid: sql<number>`count(*)`, gross: sql<number>`coalesce(sum(${orders.amountMinor}),0)`, refunded: sql<number>`coalesce(sum(${orders.refundedMinor}),0)` }).from(orders).where(eq(orders.status, "paid"));
  const [events] = await db.select({ n: sql<number>`count(*)` }).from(paymentEvents);
  return { mode: env.PAYMENTS_MODE, razorpayKeys: Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET), webhookSecret: Boolean(env.RAZORPAY_WEBHOOK_SECRET), gstConfigured: Boolean(env.GST_SUPPLIER_GSTIN && env.GST_SUPPLIER_STATE && env.GST_SUPPLIER_NAME), gstRateBp: env.GST_RATE_BP, live: await paymentsLive(db), paidOrders: Number(totals?.paid ?? 0), grossMinor: Number(totals?.gross ?? 0), refundedMinor: Number(totals?.refunded ?? 0), webhooksReceived: Number(events?.n ?? 0) };
}
