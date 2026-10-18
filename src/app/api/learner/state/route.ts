import { NextResponse } from "next/server";

import { currentSession, learnerRepository, noStore, unauthorized } from "@/server/learning/service";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await currentSession();
  if (!session) return unauthorized();

  const snapshot = await learnerRepository().loadSnapshot(session.user.id);
  return NextResponse.json({ snapshot }, { headers: noStore });
}
