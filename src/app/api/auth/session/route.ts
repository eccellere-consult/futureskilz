import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { createCurrentAuthProvider } from "@/server/auth/current-provider";
import { DatabaseSessionRepository } from "@/server/auth/database-session-repository";
import { sessionRenewThresholdMs, sessionTtlMs } from "@/server/auth/magic-link";
import { sessionCookieName, sessionCookieOptions } from "@/server/auth/session-cookie";
import { createSessionToken, hashSessionToken } from "@/server/auth/session-token";
import { createDatabase } from "@/server/db/client";
import { getServerEnvironment } from "@/server/env";

export const dynamic = "force-dynamic";

export async function GET() {
  const provider = await createCurrentAuthProvider();
  const session = await provider.getSession();

  if (!session) {
    return NextResponse.json(
      { user: null },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  let expiresAt = session.expiresAt;
  const secret = getServerEnvironment().SESSION_SECRET;
  // Silent renewal keeps returning learners signed in without ever asking again.
  if (session.sessionId && secret && expiresAt.getTime() - Date.now() < sessionRenewThresholdMs) {
    expiresAt = new Date(Date.now() + sessionTtlMs);
    const token = createSessionToken(session.sessionId, expiresAt, secret);
    await new DatabaseSessionRepository(createDatabase()).extend(session.sessionId, expiresAt, hashSessionToken(token));
    (await cookies()).set(sessionCookieName, token, sessionCookieOptions(process.env.NODE_ENV === "production", expiresAt));
  }

  return NextResponse.json(
    { user: { displayName: session.user.displayName, email: session.user.email, roles: session.user.roles }, expiresAt },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function DELETE() {
  const provider = await createCurrentAuthProvider();
  await provider.signOut();
  (await cookies()).delete(sessionCookieName);

  return new NextResponse(null, { status: 204 });
}
