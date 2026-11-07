/** /api/contribute/admin/policies — revenue-share policies (admin). GET lists them with a starting template; POST saves a draft version. */
import type { NextRequest } from "next/server";

import { listPolicies, saveDraftPolicy } from "@/server/capture/earnings-service";
import { body, handle, json } from "@/server/capture/http";

export const dynamic = "force-dynamic";

export const GET = (request: NextRequest) => handle(request, async (user) => json(await listPolicies(user.id)));

export const POST = (request: NextRequest) => handle(request, async (user) => json({ policy: await saveDraftPolicy(user.id, await body(request)) }, 201), { write: true });
