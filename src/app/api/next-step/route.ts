/** GET /api/next-step?persona=learner|coach|editor|admin — the one thing worth doing next, from the person's own data. */
import type { NextRequest } from "next/server";

import { handle, json } from "@/server/capture/http";
import { nextStepFor } from "@/server/pilot/next-step";

export const dynamic = "force-dynamic";

export const GET = (request: NextRequest) => handle(request, async (user) => json({ step: await nextStepFor(user.id, new URL(request.url).searchParams.get("persona") ?? "learner").catch(() => null) }));
