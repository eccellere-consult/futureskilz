import { NextResponse } from "next/server";
import { z } from "zod";

import { assessmentAnswersSchema } from "@/features/learner/snapshot-schema";
import { isSameOrigin, readJson } from "@/server/http/request";
import { hasCompleteAnswers } from "@/server/learning/snapshot";
import { currentSession, learnerRepository, noStore, refreshWelcomeSummary, unauthorized } from "@/server/learning/service";

export const dynamic = "force-dynamic";

const requestSchema = z.object({ answers: assessmentAnswersSchema });

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request blocked." }, { status: 403, headers: noStore });
  const session = await currentSession();
  if (!session) return unauthorized();

  const parsed = requestSchema.safeParse(await readJson(request).catch(() => null));
  if (!parsed.success || !hasCompleteAnswers(parsed.data.answers)) {
    return NextResponse.json({ error: "Answer every question to see your profile." }, { status: 400, headers: noStore });
  }

  const repository = learnerRepository();
  await repository.saveAssessment(session.user.id, parsed.data.answers);
  await refreshWelcomeSummary(session.user.id);
  return NextResponse.json({ snapshot: await repository.loadSnapshot(session.user.id) }, { headers: noStore });
}
