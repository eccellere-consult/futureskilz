import { NextResponse } from "next/server";

import { importableSnapshotSchema } from "@/features/learner/snapshot-schema";
import { isSameOrigin, readJson } from "@/server/http/request";
import { currentSession, learnerRepository, noStore, refreshWelcomeSummary, unauthorized } from "@/server/learning/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request blocked." }, { status: 403, headers: noStore });
  const session = await currentSession();
  if (!session) return unauthorized();

  const parsed = importableSnapshotSchema.safeParse(await readJson(request).catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "The saved progress could not be read." }, { status: 400, headers: noStore });

  const repository = learnerRepository();
  const { imported } = await repository.importSnapshot(session.user.id, parsed.data);
  if (imported) await refreshWelcomeSummary(session.user.id);

  return NextResponse.json({ imported, snapshot: await repository.loadSnapshot(session.user.id) }, { headers: noStore });
}
