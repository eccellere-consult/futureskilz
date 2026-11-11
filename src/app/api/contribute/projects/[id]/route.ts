/** GET /api/contribute/projects/[id] — where the interview stands: the question on screen, progress by phase, the draft timeline. */
import type { NextRequest } from "next/server";

import { body, handle, json, text } from "@/server/capture/http";
import { deleteProject, renameProject } from "@/server/capture/project-admin";
import { getView } from "@/server/capture/interview-service";

export const dynamic = "force-dynamic";

export const GET = (request: NextRequest, { params }: RouteContext<"/api/contribute/projects/[id]">) =>
  handle(request, async (user) => json(await getView(user.id, (await params).id)));

/** PATCH {title}: rename. */
export const PATCH = (request: NextRequest, { params }: RouteContext<"/api/contribute/projects/[id]">) =>
  handle(request, async (user) => json(await renameProject(user.id, (await params).id, text((await body(request)).title, 200))), { write: true });

/** DELETE: remove the project and everything unpublished made from it. */
export const DELETE = (request: NextRequest, { params }: RouteContext<"/api/contribute/projects/[id]">) =>
  handle(request, async (user) => {
    await deleteProject(user.id, (await params).id);
    return json({ removed: true });
  }, { write: true });
