/**
 * GET /api/problem-solving/connections?toolId=…&caseId=… — the golden thread for one tool of one problem: the saved work of
 * the tools it builds on and of the tools it feeds, read from the SAME problem only.
 */
import { NextRequest, NextResponse } from "next/server";

import { getSessionClient } from "@/lib/auth";
import { connectionsFor, errorResponse, fail, publishedTool, resolveCase } from "@/lib/problemSolving/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const client = await getSessionClient(req);
    if (!client) return fail(401, "Unauthorised");
    const toolId = req.nextUrl.searchParams.get("toolId")?.trim() ?? "";
    if (!toolId) return fail(400, "Missing toolId");
    if (!(await publishedTool(toolId))) return fail(404, "Tool not found");
    const resolved = await resolveCase(client, req.nextUrl.searchParams.get("caseId"));
    if ("response" in resolved) return resolved.response;
    return NextResponse.json(await connectionsFor(resolved.scope, toolId));
  } catch (error) {
    return errorResponse(error, "connections", "The connected tools could not be loaded. Please refresh.");
  }
}
