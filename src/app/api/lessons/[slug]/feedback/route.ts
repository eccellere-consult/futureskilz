/** /api/lessons/[slug]/feedback — a learner's usefulness rating (1 to 5) and optional comment; one per learner and lesson, the latest counts. */
import { NextResponse } from "next/server";

import { getSessionClient } from "@/lib/auth";
import { CaptureError } from "@/server/capture/shared";
import { myFeedback, recordFeedback } from "@/server/capture/learner-service";
import { isSameOrigin, readJson } from "@/server/http/request";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };

export async function POST(request: Request, { params }: RouteContext<"/api/lessons/[slug]/feedback">) {
  try {
    if (!isSameOrigin(request)) return NextResponse.json({ error: "Request blocked." }, { status: 403, headers });
    const input = (await readJson(request, 4_000).catch(() => ({}))) as Record<string, unknown>;
    const user = await getSessionClient(request).catch(() => null);
    const result = await recordFeedback({
      slug: (await params).slug,
      rating: Number(input.rating),
      useful: typeof input.useful === "boolean" ? input.useful : undefined,
      comment: typeof input.comment === "string" ? input.comment : undefined,
      identity: { userId: user?.id ?? null, anonymousKey: typeof input.learnerKey === "string" ? input.learnerKey : null },
    });
    return NextResponse.json(result, { headers });
  } catch (error) {
    if (error instanceof CaptureError) return NextResponse.json({ error: error.message }, { status: error.status, headers });
    console.error("[lessons/feedback]", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Feedback could not be saved." }, { status: 500, headers });
  }
}

export async function GET(request: Request, { params }: RouteContext<"/api/lessons/[slug]/feedback">) {
  const user = await getSessionClient(request).catch(() => null);
  const key = new URL(request.url).searchParams.get("learnerKey");
  const mine = await myFeedback((await params).slug, { userId: user?.id ?? null, anonymousKey: key }).catch(() => null);
  return NextResponse.json({ mine }, { headers });
}
