/**
 * /api/contribute/projects/[id]/uploads/text — POST adds a PDF the browser has already read.
 * Body: { filename, type, size, checksum (sha-256 hex), pages: [{ num, text }], ownership, attested, key? }.
 * The server's own PDF reader cannot always start on the host, so reading happens in the person's browser; the text then
 * goes through exactly the same sources, checks and review as any other upload. `key` is the file store copy, when there is one.
 */
import type { NextRequest } from "next/server";

import { body, handle, json, text } from "@/server/capture/http";
import { cleanOwnership, registerPreRead } from "@/server/capture/store-service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const POST = (request: NextRequest, { params }: RouteContext<"/api/contribute/projects/[id]/uploads/text">) =>
  handle(
    request,
    async (user) => {
      const input = await body<{ filename?: string; type?: string; size?: number; checksum?: string; pages?: unknown; ownership?: string; attested?: unknown; key?: string }>(request, 6_000_000);
      const result = await registerPreRead(user.id, (await params).id, {
        filename: text(input.filename, 255),
        type: text(input.type, 120),
        size: Number.isFinite(input.size) ? Number(input.size) : 0,
        checksum: text(input.checksum, 64),
        pages: input.pages,
        ownership: cleanOwnership(input.ownership),
        attested: input.attested === true,
        key: text(input.key, 512),
      });
      return json(result, result.duplicate ? 200 : 201);
    },
    { write: true },
  );
