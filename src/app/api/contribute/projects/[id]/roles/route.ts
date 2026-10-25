/** /api/contribute/projects/[id]/roles — the draft career timeline: add or edit a job (POST), remove one that has no answers (DELETE). */
import type { NextRequest } from "next/server";

import { body, handle, json } from "@/server/capture/http";
import { removeRole, saveRole, type RoleInput } from "@/server/capture/interview-service";

export const dynamic = "force-dynamic";

export const POST = (request: NextRequest, { params }: RouteContext<"/api/contribute/projects/[id]/roles">) =>
  handle(request, async (user) => json(await saveRole(user.id, (await params).id, await body<RoleInput>(request))), { write: true });

export const DELETE = (request: NextRequest, { params }: RouteContext<"/api/contribute/projects/[id]/roles">) =>
  handle(
    request,
    async (user) => {
      const roleId = request.nextUrl.searchParams.get("roleId") ?? "";
      return json(await removeRole(user.id, (await params).id, roleId));
    },
    { write: true },
  );
