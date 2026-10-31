/**
 * Payments against a real database, with the gateway replaced by a stand-in whose signatures always verify (the signature maths
 * itself is covered in provider.test.ts). Skipped unless CAPTURE_INTEGRATION=1, like the capture tests.
 */
import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("./provider", async (original) => {
  const actual = await original<typeof import("./provider")>();
  const stub = {
    name: "razorpay" as const,
    createOrder: async () => ({ providerOrderId: `order_${Math.random().toString(36).slice(2, 12)}`, keyId: "rzp_test" }),
    verifyCheckout: ({ signature }: { signature: string }) => signature === "good",
    verifyWebhook: (_raw: string, signature: string) => signature === "good",
  };
  return { ...actual, getPaymentProvider: () => stub };
});

const enabled = process.env.CAPTURE_INTEGRATION === "1";

describe.skipIf(!enabled)("payments, end to end", () => {
  let svc: typeof import("./service");
  let campaigns: typeof import("@/server/capture/campaign-service");
  let schema: typeof import("@/server/db/schema");
  let shared: typeof import("@/server/capture/shared");
  let admin = "";
  let buyer = "";
  let other = "";
  let planId = "";

  beforeAll(async () => {
    process.env.GST_SUPPLIER_NAME = "FutureSkilz Test Pvt Ltd";
    process.env.GST_SUPPLIER_GSTIN = "29ABCDE1234F1Z5";
    process.env.GST_SUPPLIER_STATE = "29";
    svc = await import("./service");
    campaigns = await import("@/server/capture/campaign-service");
    schema = await import("@/server/db/schema");
    shared = await import("@/server/capture/shared");
    const db = await shared.database();
    const make = async (name: string, roles: string[]) => {
      const id = randomUUID();
      await db.insert(schema.users).values({ id, email: `${name}-${id.slice(0, 6)}@example.test`, displayName: name });
      for (const role of roles) await db.insert(schema.userRoles).values({ userId: id, role });
      return id;
    };
    admin = await make("Pay Admin", ["admin"]);
    buyer = await make("Bina Buyer", []);
    other = await make("Omar Other", []);
  });

  const webhook = (event: string, payment: Record<string, unknown>, id: string, extra: Record<string, unknown> = {}) => svc.handleWebhook(JSON.stringify({ event, payload: { payment: { entity: payment }, ...extra } }), "good", id);

  it("lets only an admin make plans, keeps them off sale until switched on, and locks nothing until something is on sale", async () => {
    await expect(svc.savePlan(buyer, { code: "pass-30", name: "Thirty day pass", amountMinor: 59900, durationDays: 30 })).rejects.toThrow(/Only an admin/);
    const code = `pass-${Date.now().toString(36)}`;
    const plan = await svc.savePlan(admin, { code, name: "Thirty day pass", amountMinor: 59900, durationDays: 30 });
    planId = plan.id;
    expect(plan.active).toBe(false);
    expect(await svc.paymentsLive()).toBe(false);
    expect((await svc.skillShotAccess(buyer, "assumption-test")).reason).toBe("not-enforced");
    await svc.setPlanActive(admin, planId, true);
    expect(await svc.paymentsLive()).toBe(true);
    expect((await svc.skillShotAccess(buyer, "assumption-test")).allowed).toBe(true);
  });

  it("works out the price on the server, refuses a bad state, and applies a live code", async () => {
    await expect(svc.startCheckout(buyer, { planId, state: "99" })).rejects.toThrow(/Choose your state/);
    await expect(svc.startCheckout(buyer, { planId, state: "29", gstin: "nonsense" })).rejects.toThrow(/GSTIN/);
    await expect(svc.startCheckout(buyer, { planId, state: "29", code: "NOPE" })).rejects.toThrow(/not valid/);
    const code = `OFF${Date.now().toString(36).toUpperCase()}`.slice(0, 12);
    const made = await campaigns.createCampaign(admin, { name: "Ten off", kind: "discount", code, percentOffBp: 1000, startsAt: new Date(Date.now() - 86_400_000).toISOString(), endsAt: new Date(Date.now() + 86_400_000).toISOString(), maxRedemptions: 5 });
    await campaigns.setCampaignStatus(admin, made.id, "active");
    const order = await svc.startCheckout(buyer, { planId, state: "29", code });
    expect(order).toMatchObject({ amountMinor: 53910, discountMinor: 5990, provider: "razorpay" });
  });

  it("believes a payment only with a good signature, and only for its own buyer", async () => {
    const order = await svc.startCheckout(buyer, { planId, state: "29" });
    await expect(svc.confirmPayment(buyer, { providerOrderId: order.providerOrderId, paymentId: "pay_x", signature: "forged" })).rejects.toThrow(/could not be verified/);
    await expect(svc.confirmPayment(other, { providerOrderId: order.providerOrderId, paymentId: "pay_x", signature: "good" })).rejects.toThrow(/not found/);
    expect(await svc.hasActivePass(buyer)).toBe(false);
  });

  it("settles a payment once: invoice, pass and receipt together, with CGST and SGST in the same state", async () => {
    const db = await shared.database();
    const order = await svc.startCheckout(buyer, { planId, state: "29" });
    const payId = `pay_${Date.now()}`;
    await svc.confirmPayment(buyer, { providerOrderId: order.providerOrderId, paymentId: payId, signature: "good" });
    await svc.confirmPayment(buyer, { providerOrderId: order.providerOrderId, paymentId: payId, signature: "good" });
    const [row] = await db.select().from(schema.orders).where(eq(schema.orders.id, order.orderId));
    expect(row.status).toBe("paid");
    const invoiceRows = await db.select().from(schema.invoices).where(eq(schema.invoices.orderId, order.orderId));
    expect(invoiceRows).toHaveLength(1);
    expect(invoiceRows[0].number).toMatch(/^FS\/\d{2}-\d{2}\/\d{6}$/);
    expect(invoiceRows[0].cgstMinor + invoiceRows[0].sgstMinor + invoiceRows[0].taxableMinor).toBe(59900);
    expect(invoiceRows[0].igstMinor).toBe(0);
    expect(await db.select().from(schema.entitlements).where(eq(schema.entitlements.orderId, order.orderId))).toHaveLength(1);
    const [receipt] = await db.select().from(schema.kcReceipts).where(eq(schema.kcReceipts.externalRef, `pay:${payId}`));
    expect(receipt).toMatchObject({ grossMinor: 59900, status: "eligible", taxMinor: invoiceRows[0].cgstMinor + invoiceRows[0].sgstMinor });
    expect(await svc.hasActivePass(buyer)).toBe(true);
    expect((await svc.billingView(buyer)).invoices.length).toBeGreaterThan(0);
    // Another state is taxed as IGST, and invoice numbers keep counting.
    const second = await svc.startCheckout(other, { planId, state: "27" });
    await svc.confirmPayment(other, { providerOrderId: second.providerOrderId, paymentId: `pay_${Date.now()}b`, signature: "good" });
    const [inv2] = await db.select().from(schema.invoices).where(eq(schema.invoices.orderId, second.orderId));
    expect(inv2.igstMinor).toBeGreaterThan(0);
    expect(inv2.cgstMinor).toBe(0);
    expect(Number(inv2.number.slice(-6))).toBeGreaterThan(Number(invoiceRows[0].number.slice(-6)));
  });

  it("takes webhooks only when signed, does nothing twice, refuses a wrong amount, and ends a pass on a full refund", async () => {
    const db = await shared.database();
    const order = await svc.startCheckout(other, { planId, state: "29" });
    const payId = `pay_wh_${Date.now()}`;
    expect((await svc.handleWebhook("{}", "forged", "evt-0")).status).toBe(400);
    expect((await webhook("payment.captured", { id: payId, order_id: order.providerOrderId, amount: 100 }, `evt-a-${payId}`)).outcome).toBe("amount mismatch");
    expect((await webhook("payment.captured", { id: payId, order_id: order.providerOrderId, amount: order.amountMinor, fee: 1416 }, `evt-b-${payId}`)).outcome).toBe("paid");
    expect((await webhook("payment.captured", { id: payId, order_id: order.providerOrderId, amount: order.amountMinor }, `evt-b-${payId}`)).outcome).toBe("duplicate");
    const [receipt] = await db.select().from(schema.kcReceipts).where(eq(schema.kcReceipts.externalRef, `pay:${payId}`));
    expect(receipt.feeMinor).toBe(1416);
    expect(await db.select().from(schema.invoices).where(eq(schema.invoices.orderId, order.orderId))).toHaveLength(1);
    // A partial refund keeps the pass; a full one ends it and marks the receipt refunded.
    await svc.handleWebhook(JSON.stringify({ event: "refund.processed", payload: { refund: { entity: { payment_id: payId, amount: 1000 } } } }), "good", `evt-r1-${payId}`);
    expect((await db.select().from(schema.orders).where(eq(schema.orders.id, order.orderId)))[0]).toMatchObject({ status: "paid", refundedMinor: 1000 });
    await svc.handleWebhook(JSON.stringify({ event: "refund.processed", payload: { refund: { entity: { payment_id: payId, amount: order.amountMinor } } } }), "good", `evt-r2-${payId}`);
    expect((await db.select().from(schema.orders).where(eq(schema.orders.id, order.orderId)))[0].status).toBe("refunded");
    expect((await db.select().from(schema.entitlements).where(eq(schema.entitlements.orderId, order.orderId)))[0].status).toBe("revoked");
    expect((await db.select().from(schema.kcReceipts).where(eq(schema.kcReceipts.externalRef, `pay:${payId}`)))[0].status).toBe("refunded");
  });

  it("shows an invoice only to its buyer or an admin", async () => {
    const db = await shared.database();
    const [mine] = await db.select().from(schema.invoices).innerJoin(schema.orders, eq(schema.orders.id, schema.invoices.orderId)).where(eq(schema.orders.userId, buyer)).limit(1);
    await expect(svc.invoiceFor(other, mine.invoices.id)).rejects.toThrow(/not found/);
    expect((await svc.invoiceFor(buyer, mine.invoices.id)).id).toBe(mine.invoices.id);
    expect((await svc.invoiceFor(admin, mine.invoices.id)).id).toBe(mine.invoices.id);
    const { renderInvoice } = await import("./invoice-pdf");
    expect((await renderInvoice(mine.invoices)).subarray(0, 5).toString()).toBe("%PDF-");
  });
});
