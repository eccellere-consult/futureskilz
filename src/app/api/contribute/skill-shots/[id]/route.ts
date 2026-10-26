/** /api/contribute/skill-shots/[id] — GET one draft (editors, or the coach whose lesson it came from); PATCH a replacement blueprint; POST a workflow action. Only editors and admins act, except that the coach approves their own words. */
import type { NextRequest } from "next/server";

import { body, failure, handle, json } from "@/server/capture/http";
import { contributorApproveDraft, draftAction, getDraft, saveBlueprint, type DraftAction } from "@/server/skillshots/service";

export const dynamic = "force-dynamic";

const ACTIONS: DraftAction[] = ["submit", "approve", "request_changes", "publish", "retire"];

export const GET = (request: NextRequest, { params }: RouteContext<"/api/contribute/skill-shots/[id]">) =>
  handle(request, async (user) => json(await getDraft(user.id, (await params).id)));

export const PATCH = (request: NextRequest, { params }: RouteContext<"/api/contribute/skill-shots/[id]">) =>
  handle(request, async (user) => {
    const input = await body<{ blueprint?: unknown }>(request, 200_000);
    return json(await saveBlueprint(user.id, (await params).id, input.blueprint));
  }, { write: true });

export const POST = (request: NextRequest, { params }: RouteContext<"/api/contribute/skill-shots/[id]">) =>
  handle(request, async (user) => {
    const input = await body<{ action?: unknown }>(request);
    if (input.action === "contributor_approve") return json(await contributorApproveDraft(user.id, (await params).id));
    const action = ACTIONS.find((item) => item === input.action);
    if (!action) return failure(400, "Choose an action.");
    return json(await draftAction(user.id, (await params).id, action));
  }, { write: true });
