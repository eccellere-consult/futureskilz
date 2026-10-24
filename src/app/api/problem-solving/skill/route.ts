/**
 * /api/problem-solving/skill — "How is this analysed?": the exact methodology the AI follows for a tool. Anyone may read it
 * (it is built from the definition, so it shows signed out too); only an admin may change it.
 */
import { NextRequest, NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/auth";
import { SECTION, errorResponse, fail, publishedTool } from "@/lib/problemSolving/server";
import { getFrameworkSkill, saveFrameworkSkill } from "@/lib/strategyHubSkill";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const toolId = req.nextUrl.searchParams.get("toolId")?.trim() ?? "";
    if (!toolId) return fail(400, "Missing toolId");
    const framework = await publishedTool(toolId);
    if (!framework) return fail(404, "Tool not found");
    return NextResponse.json({ skillContent: await getFrameworkSkill(framework), canEdit: await isAdminRequest(req) });
  } catch (error) {
    return errorResponse(error, "skill GET", "The methodology could not be loaded. Please refresh.");
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!(await isAdminRequest(req))) return fail(401, "Unauthorised");
    const body = await req.json().catch(() => ({}));
    const toolId = typeof body.toolId === "string" ? body.toolId.trim() : "";
    const skillContent = typeof body.skillContent === "string" ? body.skillContent : "";
    if (!toolId) return fail(400, "Missing toolId");
    if (!skillContent.trim()) return fail(400, "The methodology cannot be empty. Leave it unchanged to keep the current version.");
    const framework = await publishedTool(toolId);
    if (!framework) return fail(404, "Tool not found");
    await saveFrameworkSkill(toolId, `Problem Solving — ${framework.name}`, skillContent, SECTION);
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error, "skill POST", "The methodology could not be saved. Please try again.");
  }
}
