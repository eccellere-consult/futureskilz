/** /api/skill-shots/[slug]/rating — a learner's star rating (1 to 5) of a Skill Shot; one per learner, the latest counts. GET gives the average and the learner's own. */
import { NextResponse } from "next/server";

import { getSessionClient } from "@/lib/auth";
import { CaptureError } from "@/server/capture/shared";
import { isSameOrigin, readJson } from "@/server/http/request";
import { myRating, rateSkillShot, ratingSummary } from "@/server/skillshots/ratings";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };

export async function POST(request: Request, { params }: RouteContext<"/api/skill-shots/[slug]/rating">) {
  try {
    if (!isSameOrigin(request)) return NextResponse.json({ error: "Request blocked." }, { status: 403, headers });
    const input = (await readJson(request, 4_000).catch(() => ({}))) as Record<string, unknown>;
    const user = await getSessionClient(request).catch(() => null);
    const result = await rateSkillShot({
      slug: (await params).slug,
      rating: Number(input.rating),
      comment: typeof input.comment === "string" ? input.comment : undefined,
      identity: { userId: user?.id ?? null, anonymousKey: typeof input.learnerKey === "string" ? input.learnerKey : null },
    });
    return NextResponse.json(result, { headers });
  } catch (error) {
    if (error instanceof CaptureError) return NextResponse.json({ error: error.message }, { status: error.status, headers });
    console.error("[skill-shots/rating]", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Your rating could not be saved. Please try again." }, { status: 500, headers });
  }
}

export async function GET(request: Request, { params }: RouteContext<"/api/skill-shots/[slug]/rating">) {
  const slug = (await params).slug;
  const user = await getSessionClient(request).catch(() => null);
  const key = new URL(request.url).searchParams.get("learnerKey");
  const [summary, mine] = await Promise.all([ratingSummary(slug).catch(() => ({ count: 0, average: null })), myRating(slug, { userId: user?.id ?? null, anonymousKey: key }).catch(() => null)]);
  return NextResponse.json({ summary, mine }, { headers });
}
