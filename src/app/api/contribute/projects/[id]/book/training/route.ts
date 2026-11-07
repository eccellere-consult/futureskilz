/** POST /api/contribute/projects/[id]/book/training — editors turn an approved book's chapters into Skill Shot drafts for review. */
import type { NextRequest } from "next/server";

import { handle, json } from "@/server/capture/http";
import { designFromBook } from "@/server/skillshots/service";

export const dynamic = "force-dynamic";

export const POST = (request: NextRequest, { params }: RouteContext<"/api/contribute/projects/[id]/book/training">) =>
  handle(request, async (user) => json(await designFromBook(user.id, (await params).id), 202), { write: true });
