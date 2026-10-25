/** POST /api/contribute/projects/[id]/documents — regenerate the working draft: knowledge package, skill.md, follow-up questions, source map. */
import type { NextRequest } from "next/server";

import { handle, json } from "@/server/capture/http";
import { generateDraft } from "@/server/capture/review-service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const POST = (request: NextRequest, { params }: RouteContext<"/api/contribute/projects/[id]/documents">) =>
  handle(request, async (user) => json(await generateDraft(user.id, (await params).id), 201), { write: true });
