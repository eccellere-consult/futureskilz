/**
 * POST /api/lessons/[slug]/events — a learner starts, progresses through, completes or uses material from a published lesson.
 * Signed-in learners are keyed by their account; guests by a random key kept in their browser. Either way only a keyed hash
 * is stored. Events are idempotent, so a retry never counts twice.
 */
import { NextResponse } from "next/server";

import { getSessionClient } from "@/lib/auth";
import { CaptureError } from "@/server/capture/shared";
import { recordEvent } from "@/server/capture/learner-service";
import { isSameOrigin, readJson } from "@/server/http/request";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: RouteContext<"/api/lessons/[slug]/events">) {
  const headers = { "Cache-Control": "no-store" };
  try {
    if (!isSameOrigin(request)) return NextResponse.json({ error: "Request blocked." }, { status: 403, headers });
    const input = (await readJson(request, 4_000).catch(() => ({}))) as Record<string, unknown>;
    const user = await getSessionClient(request).catch(() => null);
    const result = await recordEvent({
      slug: (await params).slug,
      type: String(input.type ?? ""),
      seconds: typeof input.seconds === "number" ? input.seconds : 0,
      value: typeof input.value === "number" ? input.value : undefined,
      eventKey: typeof input.eventKey === "string" ? input.eventKey : undefined,
      identity: { userId: user?.id ?? null, anonymousKey: typeof input.learnerKey === "string" ? input.learnerKey : null },
    });
    return NextResponse.json(result, { headers });
  } catch (error) {
    if (error instanceof CaptureError) return NextResponse.json({ error: error.message }, { status: error.status, headers });
    console.error("[lessons/events]", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Progress could not be saved." }, { status: 500, headers });
  }
}
