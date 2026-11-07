/**
 * /api/contribute/tna/[id]/generate — POST starts the AI for one step and answers at once (202).
 * Body: { step: "needs" | "tree" }. The page polls GET /api/contribute/tna/[id] until `working` is empty.
 */
import type { NextRequest } from "next/server";

import { body, handle, json } from "@/server/capture/http";
import { CaptureError } from "@/server/capture/shared";
import { startStep } from "@/server/tna/service";

export const dynamic = "force-dynamic";

export const POST = (request: NextRequest, { params }: RouteContext<"/api/contribute/tna/[id]/generate">) =>
  handle(
    request,
    async (user) => {
      const input = await body<{ step?: string }>(request, 1_000);
      if (input.step !== "needs" && input.step !== "tree") throw new CaptureError(400, "Choose the step: needs or tree.");
      await startStep(user.id, (await params).id, input.step);
      return json({ started: input.step }, 202);
    },
    { write: true },
  );
