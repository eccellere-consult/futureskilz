/** POST /api/contribute/projects/[id]/correction — "that summary was not right": the correction is appended to the evidence. */
import type { NextRequest } from "next/server";

import { body, handle, json, text } from "@/server/capture/http";
import { addCorrection } from "@/server/capture/interview-service";

export const dynamic = "force-dynamic";

export const POST = (request: NextRequest, { params }: RouteContext<"/api/contribute/projects/[id]/correction">) =>
  handle(
    request,
    async (user) => {
      const input = await body(request);
      await addCorrection(user.id, (await params).id, text(input.text), typeof input.roleId === "string" ? input.roleId : null);
      return json({ saved: true }, 201);
    },
    { write: true },
  );
