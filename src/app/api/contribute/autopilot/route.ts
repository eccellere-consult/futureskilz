/** GET /api/contribute/autopilot — everything Autopilot has made, newest first (editors and admins). */
import type { NextRequest } from "next/server";

import { handle, json } from "@/server/capture/http";
import { isPilotOn } from "@/server/pilot/pilot";
import { listAutopilotDrafts } from "@/server/skillshots/service";

export const dynamic = "force-dynamic";

export const GET = (request: NextRequest) => handle(request, async (user) => json({ pilotOn: await isPilotOn(), drafts: await listAutopilotDrafts(user.id) }));
