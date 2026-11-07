/** GET lists campaigns; POST creates one (discount code, extra free access, or featured placement). */
import type { NextRequest } from "next/server";

import { body, handle, json } from "@/server/capture/http";
import { createCampaign, listCampaigns } from "@/server/capture/campaign-service";

export const dynamic = "force-dynamic";

export const GET = (request: NextRequest) => handle(request, async (user) => json({ campaigns: await listCampaigns(user.id) }));
export const POST = (request: NextRequest) => handle(request, async (user) => json({ campaign: await createCampaign(user.id, await body(request)) }, 201), { write: true });
