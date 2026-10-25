/** POST /api/contribute/statements/[id]/dispute — a contributor questions an earnings statement within the policy's dispute window. */
import type { NextRequest } from "next/server";

import { disputeStatement } from "@/server/capture/earnings-service";
import { body, handle, json, text } from "@/server/capture/http";

export const dynamic = "force-dynamic";

export const POST = (request: NextRequest, { params }: RouteContext<"/api/contribute/statements/[id]/dispute">) =>
  handle(request, async (user) => {
    const input = await body(request);
    await disputeStatement(user.id, (await params).id, text(input.note, 1500));
    return json({ disputed: true });
  }, { write: true });
