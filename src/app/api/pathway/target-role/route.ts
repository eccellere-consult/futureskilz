import { NextResponse } from "next/server";
import { z } from "zod";

import { getRole } from "@/features/pathway/roles";
import { isSameOrigin, readJson } from "@/server/http/request";
import { currentSession, noStore, unauthorized } from "@/server/learning/service";
import { loadTargetRole, saveTargetRole } from "@/server/pathway/target-role";

export const dynamic = "force-dynamic";

const body = z.object({ roleId: z.string().max(60).nullable() });

export async function GET() {
  const session = await currentSession();
  if (!session) return unauthorized();
  return NextResponse.json({ roleId: await loadTargetRole(session.user.id) }, { headers: noStore });
}

export async function PUT(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request blocked." }, { status: 403, headers: noStore });
  const session = await currentSession();
  if (!session) return unauthorized();
  const parsed = body.safeParse(await readJson(request).catch(() => null));
  if (!parsed.success || (parsed.data.roleId !== null && !getRole(parsed.data.roleId))) {
    return NextResponse.json({ error: "That role is not available." }, { status: 400, headers: noStore });
  }
  await saveTargetRole(session.user.id, parsed.data.roleId);
  return NextResponse.json({ saved: true }, { headers: noStore });
}
