/** PUT /api/contribute/lessons/[lessonId]/attribution — who is credited for a lesson, in basis points adding up to 10000. */
import type { NextRequest } from "next/server";

import { body, failure, handle, json } from "@/server/capture/http";
import { setAttribution } from "@/server/capture/lesson-service";

export const dynamic = "force-dynamic";

export const PUT = (request: NextRequest, { params }: RouteContext<"/api/contribute/lessons/[lessonId]/attribution">) =>
  handle(request, async (user) => {
    const input = await body<{ shares?: Array<{ contributorId?: unknown; shareBp?: unknown; creditedAs?: unknown }> }>(request);
    if (!Array.isArray(input.shares)) return failure(400, "List who is credited.");
    const shares = input.shares.map((share) => ({ contributorId: String(share.contributorId ?? ""), shareBp: Number(share.shareBp), creditedAs: typeof share.creditedAs === "string" ? share.creditedAs : undefined }));
    return json({ attribution: await setAttribution(user.id, (await params).lessonId, shares) });
  }, { write: true });
