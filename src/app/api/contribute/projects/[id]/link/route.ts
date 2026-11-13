/**
 * /api/contribute/projects/[id]/link — POST adds a public web page or a YouTube video's captions as a source.
 * Body: { url, ownership, attested, intendedUse? }. The page is fetched from public addresses only; YouTube captions are read only
 * when the video is yours or you have permission. The address is kept as the citation.
 */
import type { NextRequest } from "next/server";

import { body, handle, json, text } from "@/server/capture/http";
import { addLinkedSource } from "@/server/capture/link-service";
import { cleanOwnership } from "@/server/capture/store-service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const POST = (request: NextRequest, { params }: RouteContext<"/api/contribute/projects/[id]/link">) =>
  handle(
    request,
    async (user) => {
      const input = await body<{ url?: string; ownership?: string; attested?: unknown; intendedUse?: string }>(request);
      const result = await addLinkedSource(user.id, (await params).id, { url: text(input.url, 500) }, { ownership: cleanOwnership(input.ownership), attested: input.attested === true, intendedUse: text(input.intendedUse, 240) });
      return json(result, result.duplicate ? 200 : 201);
    },
    { write: true },
  );
