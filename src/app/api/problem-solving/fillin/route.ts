/**
 * /api/problem-solving/fillin — the learner's saved work on one tool of one problem: the answers, the AI's analysis of them,
 * the recommendations and actions, and (after an AI fill or an import) a one-step undo.
 *
 * Signed-in only. The learner always comes from the session and the problem is checked to be theirs, so a person can only
 * read or write their own work. What the AI produces is saved by /generate and /analyze themselves; this route saves hand
 * edits (the page autosaves as the person types), imported answers (with `reason`, so they can be undone) and undo requests.
 */
import { NextRequest, NextResponse } from "next/server";

import { getSessionClient } from "@/lib/auth";
import { errorResponse, fail, publishedTool, resolveCase } from "@/lib/problemSolving/server";
import { getFillin, saveFillin, undoFieldChange } from "@/lib/strategyFillins";
import {
  EMPTY_RECORD,
  alignFields,
  fillinStatus,
  normaliseActionables,
  normaliseRecommendations,
  type FieldChangeReason,
} from "@/lib/strategyFillinTypes";
import { cleanClientFields } from "@/lib/strategyHubAi";

export const dynamic = "force-dynamic";

/** Reading back does not require the tool to still be published: a person can always see their own earlier work. */
export async function GET(req: NextRequest) {
  try {
    const client = await getSessionClient(req);
    if (!client) return fail(401, "Unauthorised");
    const toolId = req.nextUrl.searchParams.get("toolId")?.trim() ?? "";
    if (!toolId) return fail(400, "Missing toolId");
    const resolved = await resolveCase(client, req.nextUrl.searchParams.get("caseId"));
    if ("response" in resolved) return resolved.response;

    const record = (await getFillin(resolved.scope, toolId)) ?? EMPTY_RECORD;
    return NextResponse.json({ ...record, status: fillinStatus(record) });
  } catch (error) {
    return errorResponse(error, "fillin GET", "Your saved answers could not be loaded. Please refresh.");
  }
}

const IMPORT_REASONS: FieldChangeReason[] = ["template", "document"];

export async function POST(req: NextRequest) {
  try {
    const client = await getSessionClient(req);
    if (!client) return fail(401, "Unauthorised");

    const body = await req.json().catch(() => ({}));
    const toolId = typeof body.toolId === "string" ? body.toolId.trim() : "";
    if (!toolId) return fail(400, "Missing toolId");
    const framework = await publishedTool(toolId);
    if (!framework) return fail(404, "Tool not found");
    const resolved = await resolveCase(client, body.caseId);
    if ("response" in resolved) return resolved.response;

    // One-step undo of the last AI fill or import.
    if (body.undo === true) {
      const restored = await undoFieldChange(resolved.scope, toolId);
      if (!restored) return fail(409, "Nothing to undo");
      return NextResponse.json({ success: true, record: restored, status: fillinStatus(restored) });
    }

    const updates: Parameters<typeof saveFillin>[2] = {};
    if (Array.isArray(body.fields)) updates.fields = alignFields(framework.fields, cleanClientFields(body.fields));
    if (Array.isArray(body.recommendations)) updates.recommendations = normaliseRecommendations(body.recommendations);
    if (Array.isArray(body.actionables)) updates.actionables = normaliseActionables(body.actionables);
    if (Object.keys(updates).length === 0) return fail(400, "Nothing to save");

    // Only an import (not a hand edit) keeps the previous answers for an undo.
    const reason = IMPORT_REASONS.includes(body.reason as FieldChangeReason) ? (body.reason as FieldChangeReason) : undefined;
    const record = await saveFillin(resolved.scope, toolId, updates, { snapshotReason: reason });
    return NextResponse.json({ success: true, record, status: fillinStatus(record) });
  } catch (error) {
    return errorResponse(error, "fillin POST", "Your answers could not be saved. They will be saved again when you keep typing.");
  }
}
