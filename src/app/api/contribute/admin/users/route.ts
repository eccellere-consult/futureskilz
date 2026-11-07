/** /api/contribute/admin/users — admin only. GET lists accounts; POST creates one with a password (returned once). */
import type { NextRequest } from "next/server";

import { createUser, listUsers } from "@/server/auth/user-admin-service";
import { body, handle, json, text } from "@/server/capture/http";

export const dynamic = "force-dynamic";

export const GET = (request: NextRequest) => handle(request, async (user) => json({ users: await listUsers(user.id, request.nextUrl.searchParams.get("q") ?? "") }));

export const POST = (request: NextRequest) =>
  handle(request, async (user) => {
    const input = await body<Record<string, unknown>>(request, 8_000);
    return json({ created: await createUser(user.id, { email: text(input.email, 254), name: text(input.name, 160), roles: input.roles, password: typeof input.password === "string" ? input.password : undefined }) }, 201);
  }, { write: true });
