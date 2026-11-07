import { NextResponse } from "next/server";

import { cleanAnswers, diagnosticBodySchema } from "@/features/diagnostic/validate";
import { isSameOrigin, readJson } from "@/server/http/request";
import { loadDiagnostic, saveDiagnostic } from "@/server/diagnostic/service";
import { currentSession, noStore, unauthorized } from "@/server/learning/service";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await currentSession();
  if (!session) return unauthorized();
  return NextResponse.json(await loadDiagnostic(session.user.id), { headers: noStore });
}

/** Saves the answers so far. The levels are never sent or stored: they are recomputed from the answers wherever they are needed. */
export async function PUT(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request blocked." }, { status: 403, headers: noStore });
  const session = await currentSession();
  if (!session) return unauthorized();
  const parsed = diagnosticBodySchema.safeParse(await readJson(request).catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Those answers could not be saved." }, { status: 400, headers: noStore });
  await saveDiagnostic(session.user.id, cleanAnswers(parsed.data.answers), parsed.data.complete);
  return NextResponse.json({ saved: true }, { headers: noStore });
}
