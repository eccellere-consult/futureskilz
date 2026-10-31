/** POST { providerOrderId, paymentId, signature } — the browser reports a payment; it counts only if the signature verifies. */
import type { NextRequest } from "next/server";

import { body, handle, json, text } from "@/server/capture/http";
import { confirmPayment } from "@/server/payments/service";

export const dynamic = "force-dynamic";

export const POST = (request: NextRequest) =>
  handle(request, async (user) => {
    const input = await body(request);
    return json(await confirmPayment(user.id, { providerOrderId: text(input.providerOrderId, 80), paymentId: text(input.paymentId, 80), signature: text(input.signature, 128) }));
  }, { write: true });
