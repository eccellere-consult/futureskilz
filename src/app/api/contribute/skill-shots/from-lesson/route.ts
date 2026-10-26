/** POST /api/contribute/skill-shots/from-lesson { lessonId } — redesign a published coach lesson as a Skill Shot (editors and admins). */
import type { NextRequest } from "next/server";

import { body, failure, handle, json, text } from "@/server/capture/http";
import { designFromLesson } from "@/server/skillshots/service";

export const dynamic = "force-dynamic";

export const POST = (request: NextRequest) =>
  handle(request, async (user) => {
    const input = await body<{ lessonId?: unknown }>(request);
    const lessonId = text(input.lessonId, 40);
    if (!lessonId) return failure(400, "Choose a lesson.");
    return json(await designFromLesson(user.id, lessonId), 202);
  }, { write: true });
