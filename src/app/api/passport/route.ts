import { NextResponse } from "next/server";

import { currentSession, noStore, unauthorized } from "@/server/learning/service";
import { buildPassport } from "@/server/passport/service";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await currentSession();
  if (!session) return unauthorized();
  return NextResponse.json({ passport: await buildPassport(session.user.id) }, { headers: noStore });
}
