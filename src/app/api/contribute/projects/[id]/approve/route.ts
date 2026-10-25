/** POST /api/contribute/projects/[id]/approve — approve what can be published. Every blocking gate must pass, or nothing changes. */
import type { NextRequest } from "next/server";

import { handle, json } from "@/server/capture/http";
import { approvePackage } from "@/server/capture/review-service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const POST = (request: NextRequest, { params }: RouteContext<"/api/contribute/projects/[id]/approve">) =>
  handle(request, async (user) => {
    const result = await approvePackage(user.id, (await params).id);
    return json(result, result.approved ? 200 : 422);
  }, { write: true });
