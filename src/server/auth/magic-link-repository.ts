import "server-only";

import { and, count, eq, gt, gte, isNull, sql } from "drizzle-orm";

import type { Database } from "@/server/db/client";
import { auditLogs, magicLinks, userRoles, userSessions, users } from "@/server/db/schema";

import { type MagicLinkRepository, type SignInUser, signInResourceType } from "./magic-link";

const linkRequestedAction = "auth.link_requested";

export class DatabaseMagicLinkRepository implements MagicLinkRepository {
  constructor(private readonly database: Database) {}

  async findOrCreateUser(email: string, displayName: string): Promise<SignInUser> {
    await this.database
      .insert(users)
      .values({ email, displayName, status: "invited" })
      .onDuplicateKeyUpdate({ set: { email: sql`${users.email}` } });

    const [user] = await this.database
      .select({ id: users.id, email: users.email, displayName: users.displayName, status: users.status })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (!user) throw new Error("The learner account could not be created.");

    await this.database
      .insert(userRoles)
      .values({ userId: user.id, role: "learner" })
      .onDuplicateKeyUpdate({ set: { role: sql`${userRoles.role}` } });

    return user;
  }

  async countLinksSince(userId: string, since: Date): Promise<number> {
    const [result] = await this.database
      .select({ total: count() })
      .from(magicLinks)
      .where(and(eq(magicLinks.userId, userId), eq(magicLinks.resourceType, signInResourceType), gte(magicLinks.createdAt, since)));
    return result?.total ?? 0;
  }

  async countRequestsFromIpSince(ipHash: string, since: Date): Promise<number> {
    const [result] = await this.database
      .select({ total: count() })
      .from(auditLogs)
      .where(and(eq(auditLogs.action, linkRequestedAction), eq(auditLogs.resourceId, ipHash), gte(auditLogs.createdAt, since)));
    return result?.total ?? 0;
  }

  async createLink(link: {
    userId: string;
    tokenHash: string;
    redirectPath: string;
    payload: Record<string, unknown> | null;
    expiresAt: Date;
  }): Promise<void> {
    await this.database.insert(magicLinks).values({
      userId: link.userId,
      tokenHash: link.tokenHash,
      resourceType: signInResourceType,
      resourceId: link.redirectPath,
      payload: link.payload,
      expiresAt: link.expiresAt,
    });
  }

  async recordRequest(request: { userId: string; ipHash: string }): Promise<void> {
    await this.database.insert(auditLogs).values({
      actorId: request.userId,
      action: linkRequestedAction,
      resourceType: "ip-hash",
      resourceId: request.ipHash,
      metadata: {},
    });
  }

  async consumeLink(tokenHash: string, now: Date) {
    const [link] = await this.database
      .select({ id: magicLinks.id, userId: magicLinks.userId, redirectPath: magicLinks.resourceId, payload: magicLinks.payload })
      .from(magicLinks)
      .where(and(eq(magicLinks.tokenHash, tokenHash), eq(magicLinks.resourceType, signInResourceType)))
      .limit(1);
    if (!link) return null;

    // The guarded update is the single-use check: only one request can move consumed_at from NULL.
    const [result] = await this.database
      .update(magicLinks)
      .set({ consumedAt: now })
      .where(and(eq(magicLinks.id, link.id), isNull(magicLinks.consumedAt), gt(magicLinks.expiresAt, now)));
    if (result.affectedRows !== 1) return null;

    await this.database.insert(auditLogs).values({
      actorId: link.userId,
      action: "auth.signed_in",
      resourceType: "magic-link",
      resourceId: link.id,
      metadata: {},
    });

    return { userId: link.userId, redirectPath: link.redirectPath, payload: link.payload ?? null };
  }

  async activateUser(userId: string): Promise<void> {
    await this.database
      .update(users)
      .set({ status: "active" })
      .where(and(eq(users.id, userId), eq(users.status, "invited")));
  }

  async createSession(session: { id: string; userId: string; tokenHash: string; expiresAt: Date }): Promise<void> {
    await this.database.insert(userSessions).values(session);
  }
}
