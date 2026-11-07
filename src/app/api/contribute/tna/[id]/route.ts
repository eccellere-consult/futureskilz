/** /api/contribute/tna/[id] — GET the plan with its needs, topic tree and checks (also how the page polls a running step); DELETE removes it. */
import type { NextRequest } from "next/server";

import { handle, json } from "@/server/capture/http";
import { deleteProgram, getProgram } from "@/server/tna/service";

export const dynamic = "force-dynamic";

export const GET = (request: NextRequest, { params }: RouteContext<"/api/contribute/tna/[id]">) => handle(request, async (user) => json(await getProgram(user.id, (await params).id)));

export const DELETE = (request: NextRequest, { params }: RouteContext<"/api/contribute/tna/[id]">) =>
  handle(
    request,
    async (user) => {
      await deleteProgram(user.id, (await params).id);
      return json({ ok: true });
    },
    { write: true },
  );
