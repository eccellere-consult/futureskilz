/**
 * /api/contribute/projects/[id]/uploads — POST adds a document (multipart: file, ownership, optional roleId and intendedUse);
 * PATCH changes the declared ownership. The text is stored as evidence with its page or sheet; the original bytes are not kept.
 */
import type { NextRequest } from "next/server";

import { body, failure, handle, json, text } from "@/server/capture/http";
import { addUpload, setUploadOwnership, uploadHelp, type UploadMeta } from "@/server/capture/upload-service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const OWNERSHIP: UploadMeta["ownership"][] = ["mine", "permission", "third_party", "unknown"];

export const POST = (request: NextRequest, { params }: RouteContext<"/api/contribute/projects/[id]/uploads">) =>
  handle(
    request,
    async (user) => {
      const form = await request.formData().catch(() => null);
      const file = form?.get("file");
      if (!(file instanceof File)) return failure(400, "No file was uploaded.");
      if (file.size > uploadHelp.maxBytes) return failure(413, "That file is larger than 5 MB.");
      const ownership = OWNERSHIP.find((item) => item === form?.get("ownership")) ?? "unknown";
      const roleId = text(form?.get("roleId"), 36) || null;
      const result = await addUpload(user.id, (await params).id, { name: file.name, type: file.type, bytes: Buffer.from(await file.arrayBuffer()) }, { ownership, intendedUse: text(form?.get("intendedUse"), 240), roleId });
      return json(result, result.duplicate ? 200 : 201);
    },
    { write: true },
  );

export const PATCH = (request: NextRequest, { params }: RouteContext<"/api/contribute/projects/[id]/uploads">) =>
  handle(
    request,
    async (user) => {
      const input = await body(request);
      const ownership = OWNERSHIP.find((item) => item === input.ownership);
      if (!ownership || typeof input.uploadId !== "string") return failure(400, "Choose who owns this file.");
      await setUploadOwnership(user.id, (await params).id, input.uploadId, ownership);
      return json({ saved: true });
    },
    { write: true },
  );
