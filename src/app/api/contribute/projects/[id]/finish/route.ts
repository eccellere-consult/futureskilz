/** POST /api/contribute/projects/[id]/finish — end the session: a plain summary of what was covered and what is still open. */
import type { NextRequest } from "next/server";

import { handle, json } from "@/server/capture/http";
import { finishSession } from "@/server/capture/interview-service";

export const dynamic = "force-dynamic";

export const POST = (request: NextRequest, { params }: RouteContext<"/api/contribute/projects/[id]/finish">) =>
  handle(request, async (user) => json(await finishSession(user.id, (await params).id)), { write: true });
