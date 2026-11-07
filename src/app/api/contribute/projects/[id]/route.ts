/** GET /api/contribute/projects/[id] — where the interview stands: the question on screen, progress by phase, the draft timeline. */
import type { NextRequest } from "next/server";

import { handle, json } from "@/server/capture/http";
import { getView } from "@/server/capture/interview-service";

export const dynamic = "force-dynamic";

export const GET = (request: NextRequest, { params }: RouteContext<"/api/contribute/projects/[id]">) =>
  handle(request, async (user) => json(await getView(user.id, (await params).id)));
