/**
 * GET /api/problem-solving/progress?caseId=… — for one of the learner's problems, each tool's status (Filled in, Analysed,
 * Out of date) and its one-line conclusion, for the overview and the tool cards.
 */
import { NextRequest, NextResponse } from "next/server";

import { getSessionClient } from "@/lib/auth";
import { errorResponse, fail, resolveCase } from "@/lib/problemSolving/server";
import { listFillins } from "@/lib/strategyFillins";
import { analysisHeadline, fillinStatus } from "@/lib/strategyFillinTypes";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const client = await getSessionClient(req);
    if (!client) return fail(401, "Unauthorised");
    const resolved = await resolveCase(client, req.nextUrl.searchParams.get("caseId"));
    if ("response" in resolved) return resolved.response;

    const tools: Record<string, { status: string; updatedAt: string | null; headline: string | null }> = {};
    for (const r of await listFillins(resolved.scope)) {
      const status = fillinStatus(r);
      if (status === "not_started") continue;
      tools[r.toolId] = { status, updatedAt: r.updatedAt, headline: analysisHeadline(r.analysis) };
    }
    return NextResponse.json({ tools });
  } catch (error) {
    return errorResponse(error, "progress", "Your progress could not be loaded. Please refresh.");
  }
}
