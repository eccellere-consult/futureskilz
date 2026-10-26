/** GET /api/contribute/skill-shots/mine — Skill Shots built from the signed-in coach's own lessons that wait for their approval. */
import type { NextRequest } from "next/server";

import { handle, json } from "@/server/capture/http";
import { listMyApprovals } from "@/server/skillshots/service";

export const dynamic = "force-dynamic";

export const GET = (request: NextRequest) => handle(request, async (user) => json({ drafts: await listMyApprovals(user.id) }));
