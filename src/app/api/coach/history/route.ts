/** DELETE /api/coach/history?skillShot=<id> — a learner deletes their own conversation with Arya about one Skill Shot. */
import type { NextRequest } from "next/server";

import { failure, handle, json } from "@/server/capture/http";
import { deleteMyHistory } from "@/server/coach/service";

export const dynamic = "force-dynamic";

export const DELETE = (request: NextRequest) =>
  handle(request, async (user) => {
    const skillShot = new URL(request.url).searchParams.get("skillShot")?.slice(0, 80);
    if (!skillShot) return failure(400, "Choose a Skill Shot.");
    return json(await deleteMyHistory(user.id, skillShot));
  }, { write: true });
