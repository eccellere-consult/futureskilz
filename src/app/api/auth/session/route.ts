import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { createCurrentAuthProvider } from "@/server/auth/current-provider";
import { sessionCookieName } from "@/server/auth/session-cookie";

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

  return NextResponse.json(session, {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function DELETE() {
  const provider = await createCurrentAuthProvider();
  await provider.signOut();
  (await cookies()).delete(sessionCookieName);

  return new NextResponse(null, { status: 204 });
}