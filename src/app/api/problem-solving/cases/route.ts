/**
 * /api/problem-solving/cases — "My problems". GET lists the learner's open and solved problems with how many tools each has
 * started; POST starts a new one (a title and, optionally, the problem in their own words); PATCH renames it, edits the
 * brief, or marks it solved or archived. Archiving keeps the work; nothing here deletes anything.
 */
import { NextRequest, NextResponse } from "next/server";

import { getSessionClient } from "@/lib/auth";
import { SECTION, errorResponse, fail } from "@/lib/problemSolving/server";
import { isSameOrigin } from "@/server/http/request";
import { listFillins } from "@/lib/strategyFillins";
import { countFilled } from "@/lib/strategyFillinTypes";
import { createCase, listCases, updateCase, type CaseStatus } from "@/lib/workspaceCases";

export const dynamic = "force-dynamic";

const STATUSES: CaseStatus[] = ["open", "solved", "archived"];

export async function GET(req: NextRequest) {
  try {
    const client = await getSessionClient(req);
    if (!client) return fail(401, "Unauthorised");
    const cases = await listCases(client.id, SECTION);
    const withProgress = await Promise.all(
      cases.map(async (c) => {
        const saved = await listFillins({ clientId: client.id, section: SECTION, caseId: c.id });
        return { ...c, toolsStarted: saved.filter((r) => countFilled(r.fields) > 0).length };
      }),
    );
    return NextResponse.json({ cases: withProgress });
  } catch (error) {
    return errorResponse(error, "cases GET", "Your problems could not be loaded. Please refresh.");
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!isSameOrigin(req)) return fail(403, "Request blocked.");
    const client = await getSessionClient(req);
    if (!client) return fail(401, "Unauthorised");
    const body = await req.json().catch(() => ({}));
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const brief = typeof body.brief === "string" ? body.brief : "";
    if (title.length < 3) return fail(400, "Give the problem a short title (at least 3 characters).");
    const created = await createCase(client.id, SECTION, title, brief);
    return NextResponse.json({ case: { ...created, toolsStarted: 0 } }, { status: 201 });
  } catch (error) {
    return errorResponse(error, "cases POST", "The problem could not be saved. Please try again.");
  }
}

export async function PATCH(req: NextRequest) {
  try {
    if (!isSameOrigin(req)) return fail(403, "Request blocked.");
    const client = await getSessionClient(req);
    if (!client) return fail(401, "Unauthorised");
    const body = await req.json().catch(() => ({}));
    const status = STATUSES.includes(body.status) ? (body.status as CaseStatus) : undefined;
    const updated = await updateCase(client.id, SECTION, Number(body.id), {
      title: typeof body.title === "string" ? body.title : undefined,
      brief: typeof body.brief === "string" ? body.brief : undefined,
      status,
    });
    if (!updated) return fail(404, "Problem not found.");
    return NextResponse.json({ case: updated });
  } catch (error) {
    return errorResponse(error, "cases PATCH", "The problem could not be updated. Please try again.");
  }
}
