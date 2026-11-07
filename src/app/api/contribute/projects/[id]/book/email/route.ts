/** POST /api/contribute/projects/[id]/book/email — emails the finished book (interior and cover PDFs) to its author. */
import type { NextRequest } from "next/server";

import { emailBook } from "@/server/book/service";
import { handle, json } from "@/server/capture/http";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const POST = (request: NextRequest, { params }: RouteContext<"/api/contribute/projects/[id]/book/email">) =>
  handle(request, async (user) => json(await emailBook(user.id, (await params).id)), { write: true });
