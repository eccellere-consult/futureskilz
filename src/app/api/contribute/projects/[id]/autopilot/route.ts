/** POST /api/contribute/projects/[id]/autopilot — pilot mode: confirm, approve and start the Skill Shots in one go. Returns a plain report. */
import type { NextRequest } from "next/server";

import { handle, json } from "@/server/capture/http";
import { runAutopilot } from "@/server/pilot/autopilot";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const POST = (request: NextRequest, { params }: RouteContext<"/api/contribute/projects/[id]/autopilot">) => handle(request, async (user) => json(await runAutopilot(user.id, (await params).id), 202), { write: true });
