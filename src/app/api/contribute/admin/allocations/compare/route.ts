/** POST — the weighted pool and the Qualified Value Score on the same data, side by side. Saves nothing. */
import type { NextRequest } from "next/server";

import { compareFormulas } from "@/server/capture/earnings-service";
import { body, handle, json, text } from "@/server/capture/http";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const POST = (request: NextRequest) =>
  handle(request, async (user) => {
    const input = await body(request);
    return json(await compareFormulas(user.id, { policyId: text(input.policyId, 36), periodStart: text(input.periodStart, 40), periodEnd: text(input.periodEnd, 40) }));
  }, { write: true });
