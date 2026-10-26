import { NextResponse } from "next/server";
import { z } from "zod";

import { CaptureError } from "@/server/capture/shared";
import { isSameOrigin, readJson } from "@/server/http/request";
import { currentSession, noStore, unauthorized } from "@/server/learning/service";
import { createShare, listShares, revokeShare } from "@/server/passport/service";

export const dynamic = "force-dynamic";

const body = z.object({ label: z.string().max(120).optional(), days: z.number().int().optional(), include: z.object({ name: z.boolean().optional(), targetRole: z.boolean().optional(), evidence: z.boolean().optional() }).optional() });

export async function GET() {
  const session = await currentSession();
  if (!session) return unauthorized();
  return NextResponse.json({ shares: await listShares(session.user.id) }, { headers: noStore });
}

/** Creates a link. The secret is returned once and never stored in a form that can be shown again. */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request blocked." }, { status: 403, headers: noStore });
  const session = await currentSession();
  if (!session) return unauthorized();
  const parsed = body.safeParse(await readJson(request).catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Those choices could not be read." }, { status: 400, headers: noStore });
  try {
    return NextResponse.json(await createShare(session.user.id, parsed.data), { status: 201, headers: noStore });
  } catch (error) {
    if (error instanceof CaptureError) return NextResponse.json({ error: error.message }, { status: error.status, headers: noStore });
    throw error;
  }
}

export async function DELETE(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request blocked." }, { status: 403, headers: noStore });
  const session = await currentSession();
  if (!session) return unauthorized();
  const id = new URL(request.url).searchParams.get("id")?.slice(0, 40);
  if (!id) return NextResponse.json({ error: "Choose a link." }, { status: 400, headers: noStore });
  return NextResponse.json(await revokeShare(session.user.id, id), { headers: noStore });
}
