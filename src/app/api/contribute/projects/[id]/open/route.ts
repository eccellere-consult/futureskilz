/** POST /api/contribute/projects/[id]/open — begin or resume a session. A later day starts with a short recap and the saved question. */
import type { NextRequest } from "next/server";

import { handle, json } from "@/server/capture/http";
import { openInterview } from "@/server/capture/interview-service";

export const dynamic = "force-dynamic";

export const POST = (request: NextRequest, { params }: RouteContext<"/api/contribute/projects/[id]/open">) =>
  handle(request, async (user) => json(await openInterview(user.id, (await params).id)), { write: true });
