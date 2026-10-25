/** POST /api/demo/login — { code, persona }: opens a session for a sample person. Off unless the owner sets DEMO_ACCESS_CODE. */
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { checkCode, demoEnabled, startDemoSession } from "@/server/demo/access";
import { PERSONAS, type PersonaId } from "@/server/demo/personas";
import { sessionCookieName, sessionCookieOptions } from "@/server/auth/session-cookie";
import { clientIp, isSameOrigin, readJson } from "@/server/http/request";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  if (!demoEnabled()) return NextResponse.json({ error: "Not found." }, { status: 404, headers });
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request blocked." }, { status: 403, headers });
  const input = (await readJson(request, 2_000).catch(() => ({}))) as { code?: string; persona?: string };
  if (!checkCode(String(input.code ?? ""), clientIp(request))) return NextResponse.json({ error: "That access code is not right." }, { status: 401, headers });
  const persona = (Object.keys(PERSONAS) as PersonaId[]).find((id) => id === input.persona);
  if (!persona) return NextResponse.json({ error: "Choose a person." }, { status: 400, headers });
  const session = await startDemoSession(persona);
  if (!session) return NextResponse.json({ error: "The demo has not been set up yet. Use \"Set up the demo\" first." }, { status: 409, headers });
  (await cookies()).set(sessionCookieName, session.token, sessionCookieOptions(process.env.NODE_ENV === "production", session.expiresAt));
  return NextResponse.json({ redirectPath: PERSONAS[persona].landing }, { headers });
}
