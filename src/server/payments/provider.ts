import "server-only";

import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import { getServerEnvironment } from "@/server/env";

/**
 * The payment gateway, behind one small interface. Razorpay takes UPI, cards, netbanking and EMI on its own checkout, so no
 * payment method is handled here. The amount is always set by the server when the order is made; the gateway only confirms that
 * the order was paid, and a confirmation is believed only if its signature checks out.
 */
export type CreatedOrder = { providerOrderId: string; keyId: string | null };

export interface PaymentProvider {
  readonly name: "razorpay" | "test";
  createOrder(input: { amountMinor: number; currency: string; receipt: string; notes: Record<string, string> }): Promise<CreatedOrder>;
  /** The signature the checkout hands back after payment: HMAC of "order|payment". */
  verifyCheckout(input: { orderId: string; paymentId: string; signature: string }): boolean;
  /** The signature on a webhook body. */
  verifyWebhook(rawBody: string, signature: string): boolean;
}

export const hmacHex = (secret: string, payload: string): string => createHmac("sha256", secret).update(payload).digest("hex");

/** Compares two hex strings without leaking where they differ. */
export function safeEqualHex(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string" || a.length === 0 || a.length !== b.length) return false;
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
}

type RazorpayOptions = { keyId: string; keySecret: string; webhookSecret?: string; fetchImplementation?: typeof fetch };

export class RazorpayProvider implements PaymentProvider {
  readonly name = "razorpay" as const;
  private readonly fetchImplementation: typeof fetch;
  constructor(private readonly options: RazorpayOptions) {
    this.fetchImplementation = options.fetchImplementation ?? fetch;
  }

  async createOrder(input: { amountMinor: number; currency: string; receipt: string; notes: Record<string, string> }): Promise<CreatedOrder> {
    const response = await this.fetchImplementation("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Basic ${Buffer.from(`${this.options.keyId}:${this.options.keySecret}`).toString("base64")}` },
      body: JSON.stringify({ amount: input.amountMinor, currency: input.currency, receipt: input.receipt.slice(0, 40), notes: input.notes }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error(`Razorpay refused the order (${response.status}).`);
    const payload = (await response.json()) as { id?: string };
    if (!payload.id) throw new Error("Razorpay did not return an order id.");
    return { providerOrderId: payload.id, keyId: this.options.keyId };
  }

  verifyCheckout({ orderId, paymentId, signature }: { orderId: string; paymentId: string; signature: string }): boolean {
    return safeEqualHex(hmacHex(this.options.keySecret, `${orderId}|${paymentId}`), signature);
  }

  verifyWebhook(rawBody: string, signature: string): boolean {
    return Boolean(this.options.webhookSecret) && safeEqualHex(hmacHex(this.options.webhookSecret!, rawBody), signature);
  }
}

/** For demos and tests only, and only when PAYMENTS_MODE=test. It moves no money and its receipts never count as revenue. */
export class TestPaymentProvider implements PaymentProvider {
  readonly name = "test" as const;
  private static readonly secret = "futureskilz-test-payments-not-a-secret";
  async createOrder(): Promise<CreatedOrder> {
    return { providerOrderId: `test_order_${randomUUID().replaceAll("-", "").slice(0, 20)}`, keyId: null };
  }
  verifyCheckout({ orderId, paymentId, signature }: { orderId: string; paymentId: string; signature: string }): boolean {
    return safeEqualHex(TestPaymentProvider.sign(orderId, paymentId), signature);
  }
  verifyWebhook(): boolean {
    return false;
  }
  static sign(orderId: string, paymentId: string): string {
    return hmacHex(TestPaymentProvider.secret, `${orderId}|${paymentId}`);
  }
}

export function getPaymentProvider(): PaymentProvider | null {
  const env = getServerEnvironment();
  if (env.PAYMENTS_MODE === "test") return new TestPaymentProvider();
  if (env.PAYMENTS_MODE === "razorpay" && env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET) return new RazorpayProvider({ keyId: env.RAZORPAY_KEY_ID, keySecret: env.RAZORPAY_KEY_SECRET, webhookSecret: env.RAZORPAY_WEBHOOK_SECRET });
  return null;
}
