import "server-only";

import { and, eq } from "drizzle-orm";

import { DatabaseSessionRepository } from "@/server/auth/database-session-repository";
import { PersistedSessionProvider } from "@/server/auth/persisted-provider";
import { sessionCookieName } from "@/server/auth/session-cookie";
import { createDatabase } from "@/server/db/client";
import { userRoles } from "@/server/db/schema";
import { getServerEnvironment } from "@/server/env";

/**
 * Session adapter for the framework workspace engine (references/07 §2, adapter 1). The engine asks "who is the signed-in
 * client?" with getSessionClient(req); FutureSkilz answers from its own session cookie. Ids are FutureSkilz user ids (text
 * UUIDs), which is why the workspace tables key on VARCHAR(36) rather than the hub's numeric client id.
 */
export interface SessionClient {
  id: string;
  email: string;
  name: string;
  role?: string;
}

export const SESSION_COOKIE = sessionCookieName;

function readCookie(req: Request, name: string): string | null {
  const header = req.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

export async function getSessionClient(req: Request): Promise<SessionClient | null> {
  const secret = getServerEnvironment().SESSION_SECRET;
  const token = readCookie(req, sessionCookieName);
  if (!secret || !token) return null;

  const session = await new PersistedSessionProvider(token, secret, new DatabaseSessionRepository(createDatabase())).getSession();
  if (!session) return null;

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.displayName,
    role: session.user.roles.includes("admin") ? "admin" : session.user.roles[0],
  };
}

/** An admin is a signed-in user with the `admin` role in user_roles. Only admins may edit a tool's methodology. */
export async function isAdminRequest(req: Request): Promise<boolean> {
  const client = await getSessionClient(req);
  if (!client) return false;
  const [row] = await createDatabase()
    .select({ role: userRoles.role })
    .from(userRoles)
    .where(and(eq(userRoles.userId, client.id), eq(userRoles.role, "admin")))
    .limit(1);
  return Boolean(row);
}
