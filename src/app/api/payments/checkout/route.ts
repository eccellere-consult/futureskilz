/** POST { planId, state, gstin?, code? } — makes an order at a price the server works out. The learner then pays on the gateway's checkout. */
import type { NextRequest } from "next/server";

import { body, handle, json, text } from "@/server/capture/http";
import { startCheckout } from "@/server/payments/service";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export const POST = (request: NextRequest) =>
  handle(request, async (user) => {
    const input = await body(request);
    return json(await startCheckout(user.id, { planId: text(input.planId, 36), state: text(input.state, 2), gstin: text(input.gstin, 15), code: text(input.code, 40) }), 201);
  }, { write: true });
