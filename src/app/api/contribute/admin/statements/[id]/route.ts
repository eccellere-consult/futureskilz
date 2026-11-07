/** POST /api/contribute/admin/statements/[id] — finalise, mark paid, or void a statement (admin). Illustrative statements cannot be finalised. */
import type { NextRequest } from "next/server";

import { finalizeStatement } from "@/server/capture/earnings-service";
import { body, failure, handle, json } from "@/server/capture/http";

export const dynamic = "force-dynamic";

export const POST = (request: NextRequest, { params }: RouteContext<"/api/contribute/admin/statements/[id]">) =>
  handle(request, async (user) => {
    const input = await body(request);
    if (input.action !== "final" && input.action !== "paid" && input.action !== "void") return failure(400, "Choose final, paid or void.");
    await finalizeStatement(user.id, (await params).id, input.action);
    return json({ saved: true });
  }, { write: true });
