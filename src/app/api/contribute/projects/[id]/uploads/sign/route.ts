/**
 * /api/contribute/projects/[id]/uploads/sign — POST asks for a short-lived link to send one file straight to the file store.
 * Body: { filename, size, ownership, attested }. Answers 501 when the file store is not set up (the page then uses the ordinary upload).
 */
import type { NextRequest } from "next/server";

import { body, handle, json, text } from "@/server/capture/http";
import { cleanOwnership, signUpload } from "@/server/capture/store-service";

export const dynamic = "force-dynamic";

export const POST = (request: NextRequest, { params }: RouteContext<"/api/contribute/projects/[id]/uploads/sign">) =>
  handle(
    request,
    async (user) => {
      const input = await body<{ filename?: string; size?: number; ownership?: string; attested?: unknown }>(request, 4_000);
      const result = await signUpload(user.id, (await params).id, { filename: text(input.filename, 255), size: Number(input.size), ownership: cleanOwnership(input.ownership), attested: input.attested === true });
      return json(result);
    },
    { write: true },
  );
