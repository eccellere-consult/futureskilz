/** GET /api/contribute/dashboard — the contributor's content status, learner usage per lesson, and earnings statements. */
import type { NextRequest } from "next/server";

import { contributorDashboard } from "@/server/capture/earnings-service";
import { handle, json } from "@/server/capture/http";

export const dynamic = "force-dynamic";

export const GET = (request: NextRequest) => handle(request, async (user) => json(await contributorDashboard(user.id)));
