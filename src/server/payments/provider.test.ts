import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { RazorpayProvider, TestPaymentProvider, hmacHex, safeEqualHex } from "./provider";

describe("signatures", () => {
  it("compare equal strings only", () => {
    expect(safeEqualHex("abc123", "abc123")).toBe(true);
    expect(safeEqualHex("abc123", "abc124")).toBe(false);
    expect(safeEqualHex("abc", "abc123")).toBe(false);
    expect(safeEqualHex("", "")).toBe(false);
  });
});

describe("Razorpay", () => {
  const provider = new RazorpayProvider({ keyId: "rzp_test_key", keySecret: "secret-1", webhookSecret: "hook-secret-1" });
  it("accepts a checkout signature made over order and payment, and nothing else", () => {
    const signature = hmacHex("secret-1", "order_1|pay_1");
    expect(provider.verifyCheckout({ orderId: "order_1", paymentId: "pay_1", signature })).toBe(true);
    expect(provider.verifyCheckout({ orderId: "order_1", paymentId: "pay_2", signature })).toBe(false);
    expect(provider.verifyCheckout({ orderId: "order_2", paymentId: "pay_1", signature })).toBe(false);
    expect(provider.verifyCheckout({ orderId: "order_1", paymentId: "pay_1", signature: "" })).toBe(false);
  });
  it("accepts a webhook only if the body is exactly what was signed", () => {
    const body = '{"event":"payment.captured"}';
    expect(provider.verifyWebhook(body, hmacHex("hook-secret-1", body))).toBe(true);
    expect(provider.verifyWebhook(`${body} `, hmacHex("hook-secret-1", body))).toBe(false);
    expect(new RazorpayProvider({ keyId: "k", keySecret: "s" }).verifyWebhook(body, hmacHex("", body))).toBe(false);
  });
  it("creates an order with the amount the server chose and basic auth", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fake = (async (url: string, init: RequestInit) => { calls.push({ url, init }); return new Response(JSON.stringify({ id: "order_abc" })); }) as unknown as typeof fetch;
    const made = await new RazorpayProvider({ keyId: "k", keySecret: "s", fetchImplementation: fake }).createOrder({ amountMinor: 59900, currency: "INR", receipt: "r1", notes: { u: "1" } });
    expect(made).toEqual({ providerOrderId: "order_abc", keyId: "k" });
    expect(JSON.parse(String(calls[0].init.body))).toMatchObject({ amount: 59900, currency: "INR" });
    expect(String((calls[0].init.headers as Record<string, string>).authorization)).toMatch(/^Basic /);
  });
  it("fails loudly when Razorpay refuses", async () => {
    const fake = (async () => new Response("no", { status: 401 })) as unknown as typeof fetch;
    await expect(new RazorpayProvider({ keyId: "k", keySecret: "s", fetchImplementation: fake }).createOrder({ amountMinor: 100, currency: "INR", receipt: "r", notes: {} })).rejects.toThrow(/refused/);
  });
});

describe("test provider", () => {
  it("verifies only its own signatures and never a webhook", async () => {
    const test = new TestPaymentProvider();
    const { providerOrderId } = await test.createOrder();
    expect(test.verifyCheckout({ orderId: providerOrderId, paymentId: "p", signature: TestPaymentProvider.sign(providerOrderId, "p") })).toBe(true);
    expect(test.verifyCheckout({ orderId: providerOrderId, paymentId: "p", signature: "x" })).toBe(false);
    expect(test.verifyWebhook()).toBe(false);
  });
});
