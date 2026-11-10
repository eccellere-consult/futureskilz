/** GET /api/contribute/autopilot — everything Autopilot has made, newest first (editors and admins). */
import type { NextRequest } from "next/server";

import { body, handle, json } from "@/server/capture/http";
import { isPilotOn } from "@/server/pilot/pilot";
import { deleteDraft, deleteScrapDrafts, listAutopilotDrafts } from "@/server/skillshots/service";

export const dynamic = "force-dynamic";

export const GET = (request: NextRequest) => handle(request, async (user) => json({ pilotOn: await isPilotOn(), drafts: await listAutopilotDrafts(user.id) }));

/** DELETE {scrap: true}: remove every failed or placeholder-only draft made from material. DELETE {id}: remove one draft. */
export const DELETE = (request: NextRequest) =>
  handle(request, async (user) => {
    const input = await body(request);
    if (typeof input.id === "string") {
      await deleteDraft(user.id, input.id);
      return json({ removed: 1 });
    }
    return json(await deleteScrapDrafts(user.id));
  }, { write: true });
