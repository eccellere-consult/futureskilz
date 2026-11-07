import { NextResponse } from "next/server";

import { coachLessonAssets } from "@/server/pathway/coach-assets";

export const dynamic = "force-dynamic";

/** Coach lessons that can appear in a pathway. Public: published lessons are already public. A failure returns none, never an error page. */
export async function GET() {
  const assets = await coachLessonAssets().catch(() => []);
  return NextResponse.json({ assets }, { headers: { "Cache-Control": "no-store" } });
}
