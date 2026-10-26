/** GET /api/admin/overview — people, content and money at a glance (admin). */
import type { NextRequest } from "next/server";

import { adminOverview } from "@/server/capture/admin-overview-service";
import { handle, json } from "@/server/capture/http";

export const dynamic = "force-dynamic";

export const GET = (request: NextRequest) => handle(request, async (user) => json(await adminOverview(user.id)));
