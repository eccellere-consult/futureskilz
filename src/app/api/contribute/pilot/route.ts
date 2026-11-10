/** /api/contribute/pilot — GET: is the one-person pilot switch on? PUT {on}: an admin turns it on or off. */
import type { NextRequest } from "next/server";

import { body, handle, json } from "@/server/capture/http";
import { isPilotOn, setPilotMode } from "@/server/pilot/pilot";

export const dynamic = "force-dynamic";

export const GET = (request: NextRequest) => handle(request, async () => json({ on: await isPilotOn() }));
export const PUT = (request: NextRequest) =>
  handle(request, async (user) => {
    const input = await body(request);
    return json({ on: await setPilotMode(user.id, input.on === true) });
  }, { write: true });
