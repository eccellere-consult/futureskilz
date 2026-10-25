/** GET /api/contribute/projects/[id]/documents/[kind] — download skill_md, follow_up_questions, source_map or knowledge_package (?approved=1 for the approved snapshot). */
import type { NextRequest } from "next/server";

import { download, failure, handle } from "@/server/capture/http";
import { getDocument } from "@/server/capture/review-service";

export const dynamic = "force-dynamic";

const KINDS = { skill_md: ["skill.md", "text/markdown; charset=utf-8"], follow_up_questions: ["follow_up_questions.md", "text/markdown; charset=utf-8"], source_map: ["source_map.csv", "text/csv; charset=utf-8"], knowledge_package: ["knowledge_package.json", "application/json; charset=utf-8"] } as const;

export const GET = (request: NextRequest, { params }: RouteContext<"/api/contribute/projects/[id]/documents/[kind]">) =>
  handle(request, async (user) => {
    const { id, kind } = await params;
    if (!(kind in KINDS)) return failure(404, "Unknown document.");
    const [filename, type] = KINDS[kind as keyof typeof KINDS];
    const version = Number(request.nextUrl.searchParams.get("version")) || undefined;
    const doc = await getDocument(user.id, id, kind as keyof typeof KINDS, { version, approved: request.nextUrl.searchParams.get("approved") === "1" });
    return download(doc.content, `${doc.status === "approved" ? "approved_" : ""}v${doc.version}_${filename}`, type);
  });
