/** GET — what the signed-in learner can buy, their pass and their invoices. */
import type { NextRequest } from "next/server";

import { handle, json } from "@/server/capture/http";
import { billingView } from "@/server/payments/service";

export const dynamic = "force-dynamic";

export const GET = (request: NextRequest) => handle(request, async (user) => json(await billingView(user.id)));
