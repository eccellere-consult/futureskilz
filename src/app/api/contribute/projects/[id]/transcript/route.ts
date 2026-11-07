/** GET /api/contribute/projects/[id]/transcript — the plain-text transcript (interview_transcript.txt). */
import type { NextRequest } from "next/server";

import { download, handle } from "@/server/capture/http";
import { exportTranscript } from "@/server/capture/transcript-service";

export const dynamic = "force-dynamic";

export const GET = (request: NextRequest, { params }: RouteContext<"/api/contribute/projects/[id]/transcript">) =>
  handle(request, async (user) => {
    const { filename, text } = await exportTranscript(user.id, (await params).id);
    return download(text, filename);
  });
