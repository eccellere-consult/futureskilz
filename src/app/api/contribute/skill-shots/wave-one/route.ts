/** POST /api/contribute/skill-shots/wave-one — queue the twelve content wave 1 briefs for the design agent (editors and admins). */
import type { NextRequest } from "next/server";

import { handle, json } from "@/server/capture/http";
import { designWaveOne } from "@/server/skillshots/service";

export const dynamic = "force-dynamic";

export const POST = (request: NextRequest) => handle(request, async (user) => json(await designWaveOne(user.id), 202), { write: true });
