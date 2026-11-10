/** /api/contribute/tna/[id]/skill-shots — POST: start a Skill Shot draft for every approved topic that has none yet (Stage C). */
import type { NextRequest } from "next/server";

import { handle, json } from "@/server/capture/http";
import { designSkillShots } from "@/server/tna/service";

export const dynamic = "force-dynamic";

export const POST = (request: NextRequest, { params }: RouteContext<"/api/contribute/tna/[id]/skill-shots">) => handle(request, async (user) => json(await designSkillShots(user.id, (await params).id), 202), { write: true });
