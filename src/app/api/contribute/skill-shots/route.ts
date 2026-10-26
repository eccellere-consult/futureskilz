/** /api/contribute/skill-shots — GET the drafts (editors); POST a brief for the Instructional Design Agent to draft from. */
import type { NextRequest } from "next/server";

import { body, handle, json } from "@/server/capture/http";
import { designSkillShot, listDrafts } from "@/server/skillshots/service";

export const dynamic = "force-dynamic";

export const GET = (request: NextRequest) => handle(request, async (user) => json({ drafts: await listDrafts(user.id) }));

export const POST = (request: NextRequest) =>
  handle(request, async (user) => json(await designSkillShot(user.id, await body(request, 30_000)), 202), { write: true });
