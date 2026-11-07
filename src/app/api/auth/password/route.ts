/** POST /api/auth/password — { email, password, next? }: sign in with a password, for accounts an admin gave one. */
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { safeRedirectPath } from "@/server/auth/magic-link";
import { signInWithPassword } from "@/server/auth/password-service";
import { sessionCookieName, sessionCookieOptions } from "@/server/auth/session-cookie";
import { clientIp, isSameOrigin, readJson } from "@/server/http/request";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request blocked." }, { status: 403, headers });
  const input = (await readJson(request, 4_000).catch(() => ({}))) as { email?: unknown; password?: unknown; next?: unknown };
  const email = typeof input.email === "string" ? input.email : "";
  const password = typeof input.password === "string" ? input.password : "";
  if (!email || !password || password.length > 200) return NextResponse.json({ error: "Enter your email and password." }, { status: 400, headers });
  try {
    const result = await signInWithPassword({ email, password, ip: clientIp(request) });
    if (!result.ok) {
      const message = result.reason === "locked" ? "Too many wrong attempts. Try again in 15 minutes, or use the emailed link." : result.reason === "throttled" ? "Too many attempts from this network. Please wait a while." : "That email or password is not right.";
      return NextResponse.json({ error: message }, { status: result.reason === "invalid" ? 401 : 429, headers });
    }
    (await cookies()).set(sessionCookieName, result.token, sessionCookieOptions(process.env.NODE_ENV === "production", result.expiresAt));
    return NextResponse.json({ redirectPath: safeRedirectPath(typeof input.next === "string" ? input.next : undefined) }, { headers });
  } catch (error) {
    console.error("[auth/password]", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Sign-in is unavailable right now. Please try again." }, { status: 500, headers });
  }
}
