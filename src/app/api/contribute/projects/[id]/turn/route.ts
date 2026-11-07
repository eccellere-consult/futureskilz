/** POST /api/contribute/projects/[id]/turn — answer the question on screen, or skip, say "not sure", mark it confidential or revisit. */
import type { NextRequest } from "next/server";

import { body, handle, json, text } from "@/server/capture/http";
import { submitTurn, type TurnBody } from "@/server/capture/interview-service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ACTIONS: TurnBody["action"][] = ["answer", "skip", "unknown", "confidential", "revisit", "choice", "roles_confirmed", "repeat"];

export const POST = (request: NextRequest, { params }: RouteContext<"/api/contribute/projects/[id]/turn">) =>
  handle(
    request,
    async (user) => {
      const input = await body<Record<string, unknown>>(request, 40_000);
      const action = ACTIONS.find((item) => item === input.action);
      if (!action || typeof input.promptId !== "string") return json({ error: "That request could not be read." }, 400);
      const outcome = await submitTurn(user.id, (await params).id, {
        promptId: input.promptId,
        action,
        text: typeof input.text === "string" ? input.text : undefined,
        optionId: text(input.optionId, 80) || undefined,
        modality: input.modality === "voice" ? "voice" : "text",
      });
      return json(outcome);
    },
    { write: true },
  );
