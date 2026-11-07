/** POST /api/contribute/projects/[id]/withdraw — take the knowledge out of circulation; lessons are retired. */
import type { NextRequest } from "next/server";

import { body, handle, json, text } from "@/server/capture/http";
import { withdrawProject } from "@/server/capture/review-service";

export const dynamic = "force-dynamic";

export const POST = (request: NextRequest, { params }: RouteContext<"/api/contribute/projects/[id]/withdraw">) =>
  handle(request, async (user) => {
    const input = await body(request);
    await withdrawProject(user.id, (await params).id, text(input.reason, 400));
    return json({ withdrawn: true });
  }, { write: true });
