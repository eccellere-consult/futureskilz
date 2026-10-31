/** GET lists fraud flags (?status=open|confirmed|dismissed|all). POST runs the rules and records new flags for review. */
import type { NextRequest } from "next/server";

import { body, handle, json } from "@/server/capture/http";
import { listFlags, scanFraud } from "@/server/capture/fraud-service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const GET = (request: NextRequest) =>
  handle(request, async (user) => {
    const status = new URL(request.url).searchParams.get("status");
    return json({ flags: await listFlags(user.id, status === "confirmed" || status === "dismissed" || status === "all" ? status : "open") });
  });

export const POST = (request: NextRequest) => handle(request, async (user) => { await body(request).catch(() => ({})); return json(await scanFraud(user.id)); }, { write: true });
