import { NextResponse } from "next/server";
import { z } from "zod";

import { getSkillShot } from "@/features/journey/model";
import { importableSnapshotSchema } from "@/features/learner/snapshot-schema";
import { hashRequestIp, requestSignInLink, safeRedirectPath } from "@/server/auth/magic-link";
import { DatabaseMagicLinkRepository } from "@/server/auth/magic-link-repository";
import { createDatabase } from "@/server/db/client";
import { ensureDatabaseSchema } from "@/server/db/ensure-schema";
import { getServerEnvironment } from "@/server/env";
import { clientIp, isSameOrigin, readJson } from "@/server/http/request";
import { noStore } from "@/server/learning/service";
import { createProviders } from "@/server/providers";

export const dynamic = "force-dynamic";

const requestSchema = z.object({
  email: z.email().max(254),
  name: z.string().max(160).optional(),
  next: z.string().max(160).optional(),
  snapshot: importableSnapshotSchema.optional(),
});

const checkEmail = "Check your email for a sign-in link. It expires in 15 minutes.";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request blocked." }, { status: 403, headers: noStore });

  let input: z.infer<typeof requestSchema>;
  try {
    input = requestSchema.parse(await readJson(request));
  } catch {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400, headers: noStore });
  }

  const environment = getServerEnvironment();
  if (!environment.MAGIC_LINK_SECRET || !environment.SESSION_SECRET) {
    console.error("Sign-in is not configured: MAGIC_LINK_SECRET and SESSION_SECRET are required.");
    return NextResponse.json({ error: "Sign-in is temporarily unavailable." }, { status: 503, headers: noStore });
  }

  const next = safeRedirectPath(input.next);
  const nextSkillShot = next.startsWith("/skill-shots/") ? getSkillShot(next.slice("/skill-shots/".length)) : undefined;

  try {
    await ensureDatabaseSchema();
    const outcome = await requestSignInLink(
      {
        repository: new DatabaseMagicLinkRepository(createDatabase()),
        notifications: createProviders().notifications,
        appUrl: environment.APP_URL,
      },
      {
        email: input.email,
        name: input.name,
        next,
        nextSkillShotTitle: nextSkillShot?.title,
        payload: input.snapshot ?? null,
        ipHash: hashRequestIp(clientIp(request), environment.MAGIC_LINK_SECRET),
      },
    );

    if (outcome === "throttled") {
      return NextResponse.json(
        { error: "Too many sign-in requests. Please wait a few minutes and try again." },
        { status: 429, headers: noStore },
      );
    }
    return NextResponse.json({ message: checkEmail }, { headers: noStore });
  } catch (error) {
    const cause = (error instanceof Error ? error.cause : undefined) as { code?: unknown } | undefined;
    const code = (error as { code?: unknown } | null)?.code ?? cause?.code;
    console.error("Sign-in link failed", error instanceof Error ? error.message : error, code ? `[${String(code)}]` : "");
    return NextResponse.json({ error: "We could not send the email. Please try again." }, { status: 502, headers: noStore });
  }
}
