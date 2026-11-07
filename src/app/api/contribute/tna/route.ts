/** /api/contribute/tna — GET lists the training plans a coach or editor can open; POST starts one from a brief. */
import type { NextRequest } from "next/server";

import { body, handle, json } from "@/server/capture/http";
import { createProgram, listPrograms } from "@/server/tna/service";

export const dynamic = "force-dynamic";

export const GET = (request: NextRequest) => handle(request, async (user) => json({ programs: await listPrograms(user.id) }));

export const POST = (request: NextRequest) =>
  handle(
    request,
    async (user) => json(await createProgram(user.id, await body(request, 16_000)), 201),
    { write: true },
  );
