/** The book written from an interview. GET: status and manuscript. POST: start writing. PATCH: the author's edits. PUT: the author's approval. */
import type { NextRequest } from "next/server";

import { approveBook, editBook, getBookStatus, startBook } from "@/server/book/service";
import { body, handle, json, text } from "@/server/capture/http";

export const dynamic = "force-dynamic";

type Ctx = RouteContext<"/api/contribute/projects/[id]/book">;

export const GET = (request: NextRequest, { params }: Ctx) => handle(request, async (user) => json({ book: await getBookStatus(user.id, (await params).id) }));
export const POST = (request: NextRequest, { params }: Ctx) => handle(request, async (user) => json({ book: await startBook(user.id, (await params).id) }, 202), { write: true });
export const PATCH = (request: NextRequest, { params }: Ctx) =>
  handle(request, async (user) => {
    const input = await body(request);
    return json({ book: await editBook(user.id, (await params).id, { title: text(input.title, 120) || undefined, subtitle: text(input.subtitle, 200) || undefined, dedication: typeof input.dedication === "string" ? text(input.dedication, 240) : undefined }) });
  }, { write: true });
export const PUT = (request: NextRequest, { params }: Ctx) => handle(request, async (user) => json({ book: await approveBook(user.id, (await params).id) }), { write: true });
