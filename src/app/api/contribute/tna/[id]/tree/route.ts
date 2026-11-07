/**
 * /api/contribute/tna/[id]/tree — POST applies one edit to the topic tree.
 * Body: { action: "move" | "indent" | "outdent" | "remove" | "add" | "merge" | "update" | "status", ... } (see TreeAction).
 */
import type { NextRequest } from "next/server";

import { body, handle, json } from "@/server/capture/http";
import { CaptureError } from "@/server/capture/shared";
import { editTree, getProgram, type TreeAction } from "@/server/tna/service";

export const dynamic = "force-dynamic";

const ACTIONS = ["move", "indent", "outdent", "remove", "add", "merge", "update", "status"];

export const POST = (request: NextRequest, { params }: RouteContext<"/api/contribute/tna/[id]/tree">) =>
  handle(
    request,
    async (user) => {
      const input = await body<TreeAction>(request, 20_000);
      if (!input || !ACTIONS.includes(input.action)) throw new CaptureError(400, "That change is not recognised.");
      const { id } = await params;
      await editTree(user.id, id, input);
      return json(await getProgram(user.id, id));
    },
    { write: true },
  );
