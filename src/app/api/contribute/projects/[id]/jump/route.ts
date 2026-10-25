/** POST /api/contribute/projects/[id]/jump — choose another section: pick a job to explore (or revisit in more depth). */
import type { NextRequest } from "next/server";

import { body, handle, json } from "@/server/capture/http";
import { jumpTo } from "@/server/capture/interview-service";

export const dynamic = "force-dynamic";

export const POST = (request: NextRequest, { params }: RouteContext<"/api/contribute/projects/[id]/jump">) =>
  handle(
    request,
    async (user) => {
      const input = await body(request);
      return json(await jumpTo(user.id, (await params).id, typeof input.roleId === "string" ? input.roleId : null));
    },
    { write: true },
  );
