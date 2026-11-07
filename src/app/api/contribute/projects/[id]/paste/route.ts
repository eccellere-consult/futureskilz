/**
 * /api/contribute/projects/[id]/paste — POST adds pasted text (optionally with the address it came from) as a source.
 * Body: { title, text, url?, ownership, attested }. The address is kept as a citation and is never fetched.
 */
import type { NextRequest } from "next/server";

import { body, handle, json, text } from "@/server/capture/http";
import { addPastedSource, MAX_PASTED_CHARS } from "@/server/capture/source-service";
import type { UploadMeta } from "@/server/capture/upload-service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const OWNERSHIP: UploadMeta["ownership"][] = ["mine", "permission", "third_party", "unknown"];

export const POST = (request: NextRequest, { params }: RouteContext<"/api/contribute/projects/[id]/paste">) =>
  handle(
    request,
    async (user) => {
      const input = await body<{ title?: string; text?: string; url?: string; ownership?: string; attested?: unknown; intendedUse?: string }>(request, MAX_PASTED_CHARS * 4 + 4000);
      const ownership = OWNERSHIP.find((item) => item === input.ownership) ?? "unknown";
      const result = await addPastedSource(
        user.id,
        (await params).id,
        { title: text(input.title, 120), text: typeof input.text === "string" ? input.text : "", url: text(input.url, 500) },
        { ownership, attested: input.attested === true, intendedUse: text(input.intendedUse, 240) },
      );
      return json(result, result.duplicate ? 200 : 201);
    },
    { write: true },
  );
