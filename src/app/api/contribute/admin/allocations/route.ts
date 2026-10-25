/** POST /api/contribute/admin/allocations — apply a policy to a period. With an unapproved policy the statements are illustrative only. */
import type { NextRequest } from "next/server";

import { runAllocation } from "@/server/capture/earnings-service";
import { body, handle, json, text } from "@/server/capture/http";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const POST = (request: NextRequest) =>
  handle(request, async (user) => {
    const input = await body(request);
    return json(await runAllocation(user.id, { policyId: text(input.policyId, 36), periodStart: text(input.periodStart, 40), periodEnd: text(input.periodEnd, 40) }), 201);
  }, { write: true });
