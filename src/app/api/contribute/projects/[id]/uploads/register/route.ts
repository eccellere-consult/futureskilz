/**
 * /api/contribute/projects/[id]/uploads/register — POST tells the site a file has reached the file store.
 * Body: { key, filename, type, ownership, attested }. A file small enough is read at once; a larger one is recorded as stored.
 */
import type { NextRequest } from "next/server";

import { body, handle, json, text } from "@/server/capture/http";
import { cleanOwnership, registerUpload } from "@/server/capture/store-service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const POST = (request: NextRequest, { params }: RouteContext<"/api/contribute/projects/[id]/uploads/register">) =>
  handle(
    request,
    async (user) => {
      const input = await body<{ key?: string; filename?: string; type?: string; ownership?: string; attested?: unknown }>(request, 4_000);
      const result = await registerUpload(user.id, (await params).id, { key: text(input.key, 512), filename: text(input.filename, 255), type: text(input.type, 120), ownership: cleanOwnership(input.ownership), attested: input.attested === true });
      return json(result, result.duplicate ? 200 : 201);
    },
    { write: true },
  );
