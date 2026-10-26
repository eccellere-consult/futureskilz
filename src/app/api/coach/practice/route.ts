import { NextResponse } from "next/server";
import { z } from "zod";

import { isSameOrigin, readJson, clientIp } from "@/server/http/request";
import { reviewPracticeNote } from "@/server/coach/service";
import { CaptureError } from "@/server/capture/shared";
import { currentSession, noStore } from "@/server/learning/service";

export const dynamic = "force-dynamic";

const body = z.object({ skillShot: z.string().min(1).max(80), note: z.string().max(6000) });

/** Arya's feedback on a practice note, against the Skill Shot's own criteria. */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request blocked." }, { status: 403, headers: noStore });
  const parsed = body.safeParse(await readJson(request, 20_000).catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "That note could not be read." }, { status: 400, headers: noStore });
  const session = await currentSession().catch(() => null);
  try {
    const feedback = await reviewPracticeNote({ userId: session?.user.id ?? null, ip: clientIp(request), skillShotId: parsed.data.skillShot, note: parsed.data.note });
    return NextResponse.json(feedback, { headers: noStore });
  } catch (error) {
    if (error instanceof CaptureError) return NextResponse.json({ error: error.message }, { status: error.status, headers: noStore });
    console.error("[coach practice]", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Arya could not review your note just now. Please try again." }, { status: 500, headers: noStore });
  }
}
