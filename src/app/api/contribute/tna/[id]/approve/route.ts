/** /api/contribute/tna/[id]/approve — POST approves the whole plan when no check blocks it; otherwise 409 with the blocking points. */
import type { NextRequest } from "next/server";

import { handle, json } from "@/server/capture/http";
import { approveProgram, getProgram } from "@/server/tna/service";

export const dynamic = "force-dynamic";

export const POST = (request: NextRequest, { params }: RouteContext<"/api/contribute/tna/[id]/approve">) =>
  handle(
    request,
    async (user) => {
      const { id } = await params;
      await approveProgram(user.id, id);
      return json(await getProgram(user.id, id));
    },
    { write: true },
  );
