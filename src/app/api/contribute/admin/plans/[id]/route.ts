/** PATCH { active } — put a plan on or off sale. */
import type { NextRequest } from "next/server";

import { body, failure, handle, json } from "@/server/capture/http";
import { setPlanActive } from "@/server/payments/service";

export const dynamic = "force-dynamic";

export const PATCH = (request: NextRequest, { params }: RouteContext<"/api/contribute/admin/plans/[id]">) =>
  handle(request, async (user) => {
    const input = await body(request);
    if (typeof input.active !== "boolean") return failure(400, "Say whether the plan is on sale.");
    return json({ plan: await setPlanActive(user.id, (await params).id, input.active) });
  }, { write: true });
