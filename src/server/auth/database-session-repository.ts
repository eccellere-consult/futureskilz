import "server-only";

import { eq } from "drizzle-orm";

import type { Database } from "@/server/db/client";
import { userRoles, users, userSessions } from "@/server/db/schema";

import type { PersistedSession, SessionRepository } from "./persisted-provider";

export class DatabaseSessionRepository implements SessionRepository {
  constructor(private readonly database: Database) {}

  async findById(sessionId: string): Promise<PersistedSession | null> {
    const [record] = await this.database
      .select({
        id: userSessions.id,
        tokenHash: userSessions.tokenHash,
        expiresAt: userSessions.expiresAt,
        revokedAt: userSessions.revokedAt,
        userId: users.id,
        email: users.email,
        displayName: users.displayName,
        organizationId: users.organizationId,
      })
      .from(userSessions)
      .innerJoin(users, eq(userSessions.userId, users.id))
      .where(eq(userSessions.id, sessionId))
      .limit(1);

    if (!record) return null;

    const roles = await this.database
      .select({ role: userRoles.role })
      .from(userRoles)
      .where(eq(userRoles.userId, record.userId));

    return {
      id: record.id,
      tokenHash: record.tokenHash,
      expiresAt: record.expiresAt,
      revokedAt: record.revokedAt,
      user: {
        id: record.userId,
        email: record.email,
        displayName: record.displayName,
        organizationId: record.organizationId,
        roles: roles.map(({ role }) => role),
      },
    };
  }

  async revoke(sessionId: string, revokedAt: Date): Promise<void> {
    await this.database
      .update(userSessions)
      .set({ revokedAt })
      .where(eq(userSessions.id, sessionId));
  }
}