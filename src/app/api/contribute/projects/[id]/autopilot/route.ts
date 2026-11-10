/** POST /api/contribute/projects/[id]/autopilot — pilot mode: confirm, approve and start the Skill Shots in one go. Returns a plain report. */
import type { NextRequest } from "next/server";

import { handle, json } from "@/server/capture/http";
import { runAutopilot } from "@/server/pilot/autopilot";
import { listProjectDrafts } from "@/server/skillshots/service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** GET: the Skill Shot drafts made from this project so far. */
export const GET = (request: NextRequest, { params }: RouteContext<"/api/contribute/projects/[id]/autopilot">) => handle(request, async (user) => json({ drafts: await listProjectDrafts(user.id, (await params).id) }));

export const POST = (request: NextRequest, { params }: RouteContext<"/api/contribute/projects/[id]/autopilot">) => handle(request, async (user) => json(await runAutopilot(user.id, (await params).id), 202), { write: true });
