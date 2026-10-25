/** /api/contribute/lessons/[lessonId] — GET detail with gates; PATCH edit wording (editors); POST a workflow action. */
import type { NextRequest } from "next/server";

import type { LessonAction } from "@/features/capture/lesson-workflow";
import { body, failure, handle, json, text } from "@/server/capture/http";
import { editLesson, getLessonDetail, lessonAction } from "@/server/capture/lesson-service";

export const dynamic = "force-dynamic";

const ACTIONS: LessonAction[] = ["submit", "editor_approve", "request_changes", "contributor_approve", "contributor_reject", "publish", "retire"];

export const GET = (request: NextRequest, { params }: RouteContext<"/api/contribute/lessons/[lessonId]">) =>
  handle(request, async (user) => json(await getLessonDetail(user.id, (await params).lessonId)));

export const PATCH = (request: NextRequest, { params }: RouteContext<"/api/contribute/lessons/[lessonId]">) =>
  handle(request, async (user) => {
    const input = await body<Record<string, unknown>>(request, 60_000);
    const narration = Array.isArray(input.narration) ? input.narration.filter((item): item is string => typeof item === "string") : undefined;
    return json(await editLesson(user.id, (await params).lessonId, { title: text(input.title, 240) || undefined, objective: text(input.objective, 400) || undefined, narration }));
  }, { write: true });

export const POST = (request: NextRequest, { params }: RouteContext<"/api/contribute/lessons/[lessonId]">) =>
  handle(request, async (user) => {
    const input = await body(request);
    const action = ACTIONS.find((item) => item === input.action);
    if (!action) return failure(400, "Choose an action.");
    return json({ lesson: await lessonAction(user.id, (await params).lessonId, action, text(input.note, 400)) });
  }, { write: true });
