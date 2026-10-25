/** POST /api/contribute/projects/[id]/facts — confirm every plain statement in one step (sensitive and AI-synthesised ones are left for you). */
import type { NextRequest } from "next/server";

import { handle, json } from "@/server/capture/http";
import { confirmAllPlain } from "@/server/capture/review-service";

export const dynamic = "force-dynamic";

export const POST = (request: NextRequest, { params }: RouteContext<"/api/contribute/projects/[id]/facts">) =>
  handle(request, async (user) => json(await confirmAllPlain(user.id, (await params).id)), { write: true });
