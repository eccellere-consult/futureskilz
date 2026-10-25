/** /api/contribute/projects — GET lists the contributor's interviews; POST registers consent and starts one. */
import type { NextRequest } from "next/server";

import { CONSENT_LABELS, type ConsentPurpose, type ConsentState } from "@/features/capture/gates";
import { body, handle, json, text } from "@/server/capture/http";
import { createProject, listProjects } from "@/server/capture/interview-service";

export const dynamic = "force-dynamic";

export const GET = (request: NextRequest) => handle(request, async (user) => json({ projects: await listProjects(user.id) }));

export const POST = (request: NextRequest) =>
  handle(
    request,
    async (user) => {
      const input = await body<{ title?: string; language?: string; publicName?: string; consents?: Record<string, unknown> }>(request);
      const consents: ConsentState = {};
      for (const purpose of Object.keys(CONSENT_LABELS) as ConsentPurpose[]) if (typeof input.consents?.[purpose] === "boolean") consents[purpose] = input.consents[purpose] as boolean;
      const result = await createProject(user.id, { title: text(input.title, 200), language: text(input.language, 16) || "en", publicName: text(input.publicName, 160), consents });
      return json(result, 201);
    },
    { write: true },
  );
