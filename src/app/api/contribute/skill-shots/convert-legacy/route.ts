/** POST /api/contribute/skill-shots/convert-legacy — queue the five original Skill Shots for redesign at their old addresses (editors and admins). */
import type { NextRequest } from "next/server";

import { handle, json } from "@/server/capture/http";
import { convertLegacySkillShots } from "@/server/skillshots/service";

export const dynamic = "force-dynamic";

export const POST = (request: NextRequest) => handle(request, async (user) => json(await convertLegacySkillShots(user.id), 202), { write: true });
