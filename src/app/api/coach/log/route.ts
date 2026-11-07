/** GET /api/coach/log?flagged=1 — the conversation log, for editors and admins. */
import type { NextRequest } from "next/server";

import { handle, json } from "@/server/capture/http";
import { listCoachLog } from "@/server/coach/service";

export const dynamic = "force-dynamic";

export const GET = (request: NextRequest) => handle(request, async (user) => json({ rows: await listCoachLog(user.id, { flagged: new URL(request.url).searchParams.get("flagged") === "1" }) }));
