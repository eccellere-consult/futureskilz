/** GET /api/contribute/projects/[id]/review — every extracted statement with its source, the timeline checks and the publication gates. */
import type { NextRequest } from "next/server";

import { handle, json } from "@/server/capture/http";
import { getReview } from "@/server/capture/review-service";

export const dynamic = "force-dynamic";

export const GET = (request: NextRequest, { params }: RouteContext<"/api/contribute/projects/[id]/review">) =>
  handle(request, async (user) => json(await getReview(user.id, (await params).id)));
