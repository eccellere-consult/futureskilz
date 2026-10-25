/** POST /api/contribute/projects/[id]/lessons — editors turn an approved package into lesson drafts. */
import type { NextRequest } from "next/server";

import { handle, json } from "@/server/capture/http";
import { generateLessons, listLessonsForUser } from "@/server/capture/lesson-service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const POST = (request: NextRequest, { params }: RouteContext<"/api/contribute/projects/[id]/lessons">) =>
  handle(request, async (user) => json(await generateLessons(user.id, (await params).id), 201), { write: true });

export const GET = (request: NextRequest, { params }: RouteContext<"/api/contribute/projects/[id]/lessons">) =>
  handle(request, async (user) => json({ lessons: await listLessonsForUser(user.id, { projectId: (await params).id }) }));
