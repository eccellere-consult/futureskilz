/**
 * /api/contribute/projects/[id]/media — POST accepts a recording (multipart: file, ownership, attested, recordingConsent, offsetSeconds?)
 * and starts transcribing it in the background; GET lists the project's recordings with their progress so the page can poll.
 */
import type { NextRequest } from "next/server";

import { failure, handle, json, text } from "@/server/capture/http";
import { listMediaJobs, startMediaJob } from "@/server/capture/media-service";
import { cleanOwnership } from "@/server/capture/store-service";
import { MAX_TRANSCRIBE_BYTES } from "@/features/intake/media";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const POST = (request: NextRequest, { params }: RouteContext<"/api/contribute/projects/[id]/media">) =>
  handle(
    request,
    async (user) => {
      const form = await request.formData().catch(() => null);
      const file = form?.get("file");
      if (!form || !(file instanceof File)) return failure(400, "No recording was sent.");
      if (file.size > MAX_TRANSCRIBE_BYTES) return failure(413, "That recording is larger than 25 MB.");
      const job = await startMediaJob(user.id, (await params).id, { name: file.name, type: file.type, bytes: Buffer.from(await file.arrayBuffer()) }, {
        ownership: cleanOwnership(form.get("ownership")),
        attested: form.get("attested") === "true",
        recordingConsent: form.get("recordingConsent") === "true",
        offsetSeconds: Number(text(form.get("offsetSeconds"), 8)) || 0,
        intendedUse: text(form.get("intendedUse"), 240),
      });
      return json(job, 202);
    },
    { write: true },
  );

export const GET = (request: NextRequest, { params }: RouteContext<"/api/contribute/projects/[id]/media">) =>
  handle(request, async (user) => json({ jobs: await listMediaJobs(user.id, (await params).id) }));
