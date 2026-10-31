/** POST { providerOrderId } — test mode only: pays an order without money, to try the whole flow. */
import type { NextRequest } from "next/server";

import { body, handle, json, text } from "@/server/capture/http";
import { simulateTestPayment } from "@/server/payments/service";

export const dynamic = "force-dynamic";

export const POST = (request: NextRequest) => handle(request, async (user) => json(await simulateTestPayment(user.id, text((await body(request)).providerOrderId, 80))), { write: true });
