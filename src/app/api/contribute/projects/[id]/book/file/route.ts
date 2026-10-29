/** GET /api/contribute/projects/[id]/book/file?kind=interior|cover|manuscript — the print-ready PDFs and a plain-text manuscript. */
import type { NextRequest } from "next/server";

import { bookFile, type BookFile } from "@/server/book/service";
import { failure, handle } from "@/server/capture/http";

export const dynamic = "force-dynamic";

export const GET = (request: NextRequest, { params }: RouteContext<"/api/contribute/projects/[id]/book/file">) =>
  handle(request, async (user) => {
    const kind = new URL(request.url).searchParams.get("kind");
    if (kind !== "interior" && kind !== "cover" && kind !== "manuscript") return failure(400, "Choose interior, cover or manuscript.");
    const file = await bookFile(user.id, (await params).id, kind as BookFile);
    return new Response(new Uint8Array(file.body), { headers: { "Content-Type": file.type, "Content-Disposition": `attachment; filename="${file.name}"`, "Cache-Control": "no-store" } });
  });
