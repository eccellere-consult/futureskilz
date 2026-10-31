/**
 * POST — Razorpay's notifications. Public by nature, so nothing is trusted until the body's signature verifies against the webhook
 * secret. Each event is recorded by id, so a retry does nothing twice.
 */
import { handleWebhook } from "@/server/payments/service";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: Request): Promise<Response> {
  const raw = await request.text();
  if (raw.length > 200_000) return Response.json({ ok: false }, { status: 413 });
  try {
    const result = await handleWebhook(raw, request.headers.get("x-razorpay-signature") ?? "", request.headers.get("x-razorpay-event-id") ?? "");
    return Response.json({ ok: result.ok }, { status: result.status });
  } catch (error) {
    console.error("[webhook]", error instanceof Error ? error.message : error);
    // A failure we want retried: Razorpay retries on any non-2xx answer.
    return Response.json({ ok: false }, { status: 500 });
  }
}
