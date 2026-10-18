import { NextResponse } from "next/server";

import { learnerDraftSchema } from "@/features/learner/snapshot-schema";
import { isSameOrigin, readJson } from "@/server/http/request";
import { currentSession, learnerRepository, noStore, unauthorized } from "@/server/learning/service";

export const dynamic = "force-dynamic";

export async function PUT(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request blocked." }, { status: 403, headers: noStore });
  const session = await currentSession();
  if (!session) return unauthorized();

  const parsed = learnerDraftSchema.safeParse(await readJson(request).catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Some answers could not be saved." }, { status: 400, headers: noStore });

  await learnerRepository().saveDraft(session.user.id, parsed.data);
  return NextResponse.json({ saved: true }, { headers: noStore });
}
