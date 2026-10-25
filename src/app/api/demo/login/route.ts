/**
 * POST /api/demo/login — { email, password } (or { persona, code }): opens a session for one of the four sample people. The shared
 * demo password is the owner's DEMO_ACCESS_CODE; the route is off without it and never signs in an address outside the demo domain.
 */
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
  const input = (await readJson(request, 2_000).catch(() => ({}))) as { code?: string; password?: string; persona?: string; email?: string };
  const secret = String(input.password ?? input.code ?? "");
  if (!checkCode(secret, clientIp(request))) return NextResponse.json({ error: input.email ? "That email or password is not right." : "That password is not right." }, { status: 401, headers });
  const ids = Object.keys(PERSONAS) as PersonaId[];
  const persona = input.email ? ids.find((id) => PERSONAS[id].email === String(input.email).trim().toLowerCase()) : ids.find((id) => id === input.persona);
  if (!persona) return NextResponse.json({ error: input.email ? "That email or password is not right." : "Choose a person." }, { status: input.email ? 401 : 400, headers });
  const session = await startDemoSession(persona);
  if (!session) return NextResponse.json({ error: "The demo has not been set up yet. Use \"Set up the demo\" first." }, { status: 409, headers });
  (await cookies()).set(sessionCookieName, session.token, sessionCookieOptions(process.env.NODE_ENV === "production", session.expiresAt));
  return NextResponse.json({ redirectPath: PERSONAS[persona].landing }, { headers });
}
