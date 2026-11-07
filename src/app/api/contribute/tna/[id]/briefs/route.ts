/** /api/contribute/tna/[id]/briefs — GET the Skill Shot briefs of an approved plan (the hand-off to the design step). Nothing is designed here. */
import type { NextRequest } from "next/server";

import { handle, json } from "@/server/capture/http";
import { briefsFor } from "@/server/tna/service";

export const dynamic = "force-dynamic";

export const GET = (request: NextRequest, { params }: RouteContext<"/api/contribute/tna/[id]/briefs">) => handle(request, async (user) => json({ briefs: await briefsFor(user.id, (await params).id) }));
