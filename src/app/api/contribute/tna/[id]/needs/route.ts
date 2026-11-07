/** /api/contribute/tna/[id]/needs — PUT saves the person's edits to the learner needs (confirm, reject, reword, add). Body: { needs: [...] }. */
import type { NextRequest } from "next/server";

import { body, handle, json } from "@/server/capture/http";
import { saveNeeds } from "@/server/tna/service";

export const dynamic = "force-dynamic";

export const PUT = (request: NextRequest, { params }: RouteContext<"/api/contribute/tna/[id]/needs">) =>
  handle(
    request,
    async (user) => {
      const input = await body<{ needs?: unknown }>(request, 40_000);
      await saveNeeds(user.id, (await params).id, input.needs);
      return json({ ok: true });
    },
    { write: true },
  );
