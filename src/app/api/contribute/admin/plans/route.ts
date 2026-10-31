/** GET lists every plan; POST creates or updates one (switched off until put on sale). */
import type { NextRequest } from "next/server";

import { body, handle, json } from "@/server/capture/http";
import { listAllPlans, savePlan } from "@/server/payments/service";

export const dynamic = "force-dynamic";

export const GET = (request: NextRequest) => handle(request, async (user) => json({ plans: await listAllPlans(user.id) }));
export const POST = (request: NextRequest) => handle(request, async (user) => json({ plan: await savePlan(user.id, await body(request)) }, 201), { write: true });
