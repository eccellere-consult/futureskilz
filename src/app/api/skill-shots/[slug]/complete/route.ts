import { NextResponse } from "next/server";
import { z } from "zod";

import { getSkillShot } from "@/features/journey/model";
import { isSameOrigin, readJson } from "@/server/http/request";
import { currentSession, learnerRepository, noStore, refreshWelcomeSummary, unauthorized } from "@/server/learning/service";

export const dynamic = "force-dynamic";

const requestSchema = z.object({
  practice: z.string().trim().max(4000).default(""),
  checkInAnswer: z.number().int().min(0).max(9),
});

export async function POST(request: Request, { params }: RouteContext<"/api/skill-shots/[slug]/complete">) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request blocked." }, { status: 403, headers: noStore });
  const session = await currentSession();
  if (!session) return unauthorized();

  const { slug } = await params;
  if (!getSkillShot(slug)) return NextResponse.json({ error: "Skill Shot not found." }, { status: 404, headers: noStore });

  const parsed = requestSchema.safeParse(await readJson(request).catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose an answer first." }, { status: 400, headers: noStore });

  // The server checks the answer itself, so the browser can never award its own evidence.
  const repository = learnerRepository();
  const outcome = await repository.completeSkillShot(session.user.id, slug, parsed.data.practice, parsed.data.checkInAnswer);
  // New evidence changes the next step, so Arya's summary is rewritten to match.
  if (outcome.evidenceAdded) await refreshWelcomeSummary(session.user.id);
  return NextResponse.json({ ...outcome, snapshot: await repository.loadSnapshot(session.user.id) }, { headers: noStore });
}
