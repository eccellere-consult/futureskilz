/** /api/contribute/skill-shots/refresh — GET: how many older Skill Shots can be refreshed. POST: refresh them to today's rules (editors and admins). */
import type { NextRequest } from "next/server";

import { handle, json } from "@/server/capture/http";
import { countRefreshable, refreshAllDrafts } from "@/server/skillshots/service";

export const dynamic = "force-dynamic";

export const GET = (request: NextRequest) => handle(request, async (user) => json({ refreshable: await countRefreshable(user.id) }));
export const POST = (request: NextRequest) => handle(request, async (user) => json(await refreshAllDrafts(user.id), 202), { write: true });
