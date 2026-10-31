/** PATCH { action: "confirm" | "dismiss", note } — an admin's decision on one flag. Confirming removes a learner's activity from allocations. */
import type { NextRequest } from "next/server";

import { body, failure, handle, json, text } from "@/server/capture/http";
import { reviewFlag } from "@/server/capture/fraud-service";

export const dynamic = "force-dynamic";

export const PATCH = (request: NextRequest, { params }: RouteContext<"/api/contribute/admin/fraud/[id]">) =>
  handle(request, async (user) => {
    const input = await body(request);
    if (input.action !== "confirm" && input.action !== "dismiss") return failure(400, "Choose confirm or dismiss.");
    return json({ flag: await reviewFlag(user.id, (await params).id, input.action, text(input.note, 1000)) });
  }, { write: true });
