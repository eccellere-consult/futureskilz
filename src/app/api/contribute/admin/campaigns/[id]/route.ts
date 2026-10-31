/** PATCH { status: "active" | "paused" | "ended" } */
import type { NextRequest } from "next/server";

import { body, failure, handle, json } from "@/server/capture/http";
import { setCampaignStatus } from "@/server/capture/campaign-service";

export const dynamic = "force-dynamic";

export const PATCH = (request: NextRequest, { params }: RouteContext<"/api/contribute/admin/campaigns/[id]">) =>
  handle(request, async (user) => {
    const input = await body(request);
    if (input.status !== "active" && input.status !== "paused" && input.status !== "ended") return failure(400, "Choose active, paused or ended.");
    return json({ campaign: await setCampaignStatus(user.id, (await params).id, input.status) });
  }, { write: true });
