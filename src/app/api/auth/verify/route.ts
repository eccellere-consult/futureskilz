import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { importableSnapshotSchema } from "@/features/learner/snapshot-schema";
import { completeSignIn } from "@/server/auth/magic-link";
import { DatabaseMagicLinkRepository } from "@/server/auth/magic-link-repository";
import { sessionCookieName, sessionCookieOptions } from "@/server/auth/session-cookie";
import { createDatabase } from "@/server/db/client";
import { ensureDatabaseSchema } from "@/server/db/ensure-schema";
import { getServerEnvironment } from "@/server/env";
import { isSameOrigin, readJson } from "@/server/http/request";
import { learnerRepository, noStore, refreshWelcomeSummary } from "@/server/learning/service";

export const dynamic = "force-dynamic";

const requestSchema = z.object({ token: z.string().max(100) });

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request blocked." }, { status: 403, headers: noStore });

  const secret = getServerEnvironment().SESSION_SECRET;
  const parsed = requestSchema.safeParse(await readJson(request).catch(() => null));
  if (!secret || !parsed.success) {
    return NextResponse.json({ error: "This sign-in link is not valid." }, { status: 400, headers: noStore });
  }

  await ensureDatabaseSchema();
  const signIn = await completeSignIn(
    { repository: new DatabaseMagicLinkRepository(createDatabase()), sessionSecret: secret },
    parsed.data.token,
  );
  if (!signIn) {
    return NextResponse.json(
      { error: "This link has expired or was already used. Request a new one." },
      { status: 410, headers: noStore },
    );
  }

  (await cookies()).set(sessionCookieName, signIn.sessionToken, sessionCookieOptions(process.env.NODE_ENV === "production", signIn.expiresAt));

  // The guest snapshot travelled with the link, so progress arrives on whichever device opened it.
  const snapshot = importableSnapshotSchema.safeParse(signIn.payload);
  let carriedProgress = false;
  if (snapshot.success) {
    try {
      const { imported } = await learnerRepository().importSnapshot(signIn.userId, snapshot.data);
      // Only a successful import lets the browser forget its copy.
      carriedProgress = true;
      if (imported) await refreshWelcomeSummary(signIn.userId);
    } catch (error) {
      console.error("Guest progress import failed", error instanceof Error ? error.message : error);
    }
  }

  return NextResponse.json({ redirectPath: signIn.redirectPath, carriedProgress }, { headers: noStore });
}
