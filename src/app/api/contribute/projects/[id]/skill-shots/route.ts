/** Skill Shots made from a contributor's approved knowledge package. GET: the pieces it would make. POST: make them (all, or the keys given). */
import type { NextRequest } from "next/server";

import { body, handle, json } from "@/server/capture/http";
import { designFromProject, previewFromProject } from "@/server/skillshots/service";

export const dynamic = "force-dynamic";

type Ctx = RouteContext<"/api/contribute/projects/[id]/skill-shots">;

export const GET = (request: NextRequest, { params }: Ctx) => handle(request, async (user) => json(await previewFromProject(user.id, (await params).id)));
export const POST = (request: NextRequest, { params }: Ctx) =>
  handle(request, async (user) => {
    const input = await body(request).catch(() => ({}) as Record<string, unknown>);
    const keys = Array.isArray(input.keys) ? input.keys.filter((key): key is string => typeof key === "string").slice(0, 60) : undefined;
    return json(await designFromProject(user.id, (await params).id, keys), 202);
  }, { write: true });
