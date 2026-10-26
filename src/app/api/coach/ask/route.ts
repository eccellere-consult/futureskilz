import { NextResponse } from "next/server";
import { z } from "zod";

import { isSameOrigin, readJson, clientIp } from "@/server/http/request";
import { askArya } from "@/server/coach/service";
import { CaptureError } from "@/server/capture/shared";
import { currentSession, noStore } from "@/server/learning/service";

export const dynamic = "force-dynamic";

const body = z.object({
  skillShot: z.string().min(1).max(80),
  message: z.string().max(2000),
  sceneId: z.string().max(60).optional(),
  answered: z.array(z.string().max(60)).max(30).default([]),
  history: z.array(z.object({ role: z.enum(["learner", "arya"]), text: z.string().max(1000) })).max(8).default([]),
});

/** Ask Arya, inside a Skill Shot. Open to visitors too (more tightly limited), and nothing is kept for them. */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request blocked." }, { status: 403, headers: noStore });
  const parsed = body.safeParse(await readJson(request, 20_000).catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "That question could not be read." }, { status: 400, headers: noStore });
  const session = await currentSession().catch(() => null);
  try {
    const answer = await askArya({ userId: session?.user.id ?? null, ip: clientIp(request), skillShotId: parsed.data.skillShot, message: parsed.data.message, scope: { sceneId: parsed.data.sceneId, answered: parsed.data.answered }, history: parsed.data.history });
    return NextResponse.json(answer, { headers: noStore });
  } catch (error) {
    if (error instanceof CaptureError) return NextResponse.json({ error: error.message }, { status: error.status, headers: noStore });
    console.error("[coach ask]", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Arya could not answer just now. Please try again." }, { status: 500, headers: noStore });
  }
}
