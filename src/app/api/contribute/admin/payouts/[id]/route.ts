/** PATCH { reference } — records the bank transfer reference, marks the payout and its statement paid. */
import type { NextRequest } from "next/server";

import { body, handle, json, text } from "@/server/capture/http";
import { markPayoutPaid } from "@/server/payments/payout-service";

export const dynamic = "force-dynamic";

export const PATCH = (request: NextRequest, { params }: RouteContext<"/api/contribute/admin/payouts/[id]">) =>
  handle(request, async (user) => json({ payout: await markPayoutPaid(user.id, (await params).id, text((await body(request)).reference, 120)) }), { write: true });
