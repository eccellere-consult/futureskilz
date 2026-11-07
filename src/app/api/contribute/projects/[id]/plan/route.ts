/** POST /api/contribute/projects/[id]/plan — the contributor chooses how the interview is shaped (Arya leads, edit her outline, or their own). */
import type { NextRequest } from "next/server";

import { body, handle, json } from "@/server/capture/http";
import { setInterviewPlan } from "@/server/capture/interview-service";

export const dynamic = "force-dynamic";

export const POST = (request: NextRequest, { params }: RouteContext<"/api/contribute/projects/[id]/plan">) =>
  handle(request, async (user) => json(await setInterviewPlan(user.id, (await params).id, await body(request))), { write: true });
