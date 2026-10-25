/** PUT /api/contribute/consents — grant or withdraw a consent purpose (optionally for one project). Every change is recorded. */
import type { NextRequest } from "next/server";

import { CONSENT_LABELS, type ConsentPurpose, type ConsentState } from "@/features/capture/gates";
import { body, handle, json } from "@/server/capture/http";
import { currentConsents, updateConsents } from "@/server/capture/interview-service";
import { database } from "@/server/capture/shared";

export const dynamic = "force-dynamic";

export const GET = (request: NextRequest) => handle(request, async (user) => json({ consents: await currentConsents(await database(), user.id) }));

export const PUT = (request: NextRequest) =>
  handle(request, async (user) => {
    const input = await body<{ projectId?: string; consents?: Record<string, unknown> }>(request);
    const consents: ConsentState = {};
    for (const purpose of Object.keys(CONSENT_LABELS) as ConsentPurpose[]) if (typeof input.consents?.[purpose] === "boolean") consents[purpose] = input.consents[purpose] as boolean;
    return json({ consents: await updateConsents(user.id, typeof input.projectId === "string" ? input.projectId : null, consents) });
  }, { write: true });
