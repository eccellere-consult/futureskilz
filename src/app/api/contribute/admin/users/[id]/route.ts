/** POST /api/contribute/admin/users/[id] — { action: "reset_password" | "suspend" | "activate" | "set_roles" } (admin only). */
import type { NextRequest } from "next/server";

import { resetPassword, setUserRoles, setUserStatus } from "@/server/auth/user-admin-service";
import { body, failure, handle, json } from "@/server/capture/http";

export const dynamic = "force-dynamic";

export const POST = (request: NextRequest, { params }: RouteContext<"/api/contribute/admin/users/[id]">) =>
  handle(request, async (user) => {
    const input = await body<Record<string, unknown>>(request, 4_000);
    const { id } = await params;
    switch (input.action) {
      case "reset_password":
        return json(await resetPassword(user.id, id, typeof input.password === "string" ? input.password : undefined));
      case "suspend":
      case "activate":
        await setUserStatus(user.id, id, input.action === "suspend" ? "suspended" : "active");
        return json({ saved: true });
      case "set_roles":
        return json({ roles: await setUserRoles(user.id, id, input.roles) });
      default:
        return failure(400, "Choose an action.");
    }
  }, { write: true });
