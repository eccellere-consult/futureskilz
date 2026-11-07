/**
 * /api/contribute/tna/assist — POST suggests the boxes a coach has left empty at the start of a plan and asks the few questions
 * that would change them. Body: { topic, role?, level?, language?, goal?, minutesPerLearner?, notes?, context?, answers? }.
 * One short AI call, nothing is saved; without an AI it answers with plain tap-to-answer questions.
 */
import type { NextRequest } from "next/server";

import { body, handle, json } from "@/server/capture/http";
import { assistBrief } from "@/server/tna/service";

export const dynamic = "force-dynamic";

export const POST = (request: NextRequest) => handle(request, async (user) => json(await assistBrief(user.id, await body(request, 16_000))), { write: true });
