import "server-only";

import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";

import { createDatabase } from "@/server/db/client";
import { ensureDatabaseSchema } from "@/server/db/ensure-schema";
import { auditLogs, userCredentials, userRoles, users } from "@/server/db/schema";
import { getServerEnvironment } from "@/server/env";

import { DatabaseMagicLinkRepository } from "./magic-link-repository";
import { sessionTtlMs } from "./magic-link";
import { dummyHash, hashPassword, passwordProblem, verifyPassword } from "./password";
import { createSessionToken, hashSessionToken } from "./session-token";

const MAX_FAILURES = 5;
const LOCK_MS = 15 * 60_000;
const IP_WINDOW_MS = 15 * 60_000;
const IP_LIMIT = 30;
const ipAttempts = new Map<string, { count: number; since: number }>();

export type PasswordSignIn = { ok: true; userId: string; token: string; expiresAt: Date } | { ok: false; reason: "invalid" | "locked" | "throttled" };

export const normalizeEmail = (email: string): string => email.trim().toLowerCase();

/**
 * Signs in with an email and password. Every failure looks alike to the caller ("invalid"), an unknown address costs as much
 * time as a wrong password, five wrong guesses lock the account for fifteen minutes, and one address cannot hammer the form.
 */
export async function signInWithPassword(input: { email: string; password: string; ip: string }): Promise<PasswordSignIn> {
  const secret = getServerEnvironment().SESSION_SECRET;
  if (!secret) return { ok: false, reason: "invalid" };
  const now = Date.now();
  const seen = ipAttempts.get(input.ip);
  if (!seen || now - seen.since > IP_WINDOW_MS) ipAttempts.set(input.ip, { count: 1, since: now });
  else if (++seen.count > IP_LIMIT) return { ok: false, reason: "throttled" };

  await ensureDatabaseSchema();
  const db = createDatabase();
  const email = normalizeEmail(input.email);
  const [row] = await db
    .select({ id: users.id, status: users.status, hash: userCredentials.passwordHash, lockedUntil: userCredentials.lockedUntil, failed: userCredentials.failedAttempts })
    .from(users)
    .leftJoin(userCredentials, eq(userCredentials.userId, users.id))
    .where(eq(users.email, email))
    .limit(1);

  if (!row || !row.hash || row.status !== "active") {
    await verifyPassword(input.password, await dummyHash());
    return { ok: false, reason: "invalid" };
  }
  if (row.lockedUntil && row.lockedUntil.getTime() > now) return { ok: false, reason: "locked" };

  if (!(await verifyPassword(input.password, row.hash))) {
    const failed = (row.failed ?? 0) + 1;
    await db
      .update(userCredentials)
      .set(failed >= MAX_FAILURES ? { failedAttempts: 0, lockedUntil: new Date(now + LOCK_MS) } : { failedAttempts: failed })
      .where(eq(userCredentials.userId, row.id));
    await db.insert(auditLogs).values({ actorId: row.id, action: failed >= MAX_FAILURES ? "auth.password_locked" : "auth.password_failed", resourceType: "user", resourceId: row.id, metadata: {} });
    return { ok: false, reason: failed >= MAX_FAILURES ? "locked" : "invalid" };
  }

  await db.update(userCredentials).set({ failedAttempts: 0, lockedUntil: null }).where(eq(userCredentials.userId, row.id));
  const sessionId = randomUUID();
  const expiresAt = new Date(now + sessionTtlMs);
  const token = createSessionToken(sessionId, expiresAt, secret);
  await new DatabaseMagicLinkRepository(db).createSession({ id: sessionId, userId: row.id, tokenHash: hashSessionToken(token), expiresAt });
  await db.insert(auditLogs).values({ actorId: row.id, action: "auth.password_signed_in", resourceType: "user", resourceId: row.id, metadata: {} });
  return { ok: true, userId: row.id, token, expiresAt };
}

export async function setPassword(userId: string, password: string, setBy: string | null): Promise<void> {
  const problem = passwordProblem(password);
  if (problem) throw new Error(problem);
  const db = createDatabase();
  const passwordHash = await hashPassword(password);
  await db
    .insert(userCredentials)
    .values({ userId, passwordHash, setBy })
    .onDuplicateKeyUpdate({ set: { passwordHash, failedAttempts: 0, lockedUntil: null, setBy } });
}

/** The owner's address(es) from BOOTSTRAP_ADMIN_EMAILS become admins when they sign in, so the first admin never needs a database. */
export async function grantBootstrapRoles(userId: string): Promise<void> {
  const list = (getServerEnvironment().BOOTSTRAP_ADMIN_EMAILS ?? "").split(",").map(normalizeEmail).filter(Boolean);
  if (list.length === 0) return;
  const db = createDatabase();
  const [user] = await db.select({ email: users.email }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user || !list.includes(normalizeEmail(user.email))) return;
  for (const role of ["admin", "editor"]) {
    const [existing] = await db.select().from(userRoles).where(and(eq(userRoles.userId, userId), eq(userRoles.role, role))).limit(1);
    if (!existing) await db.insert(userRoles).values({ userId, role });
  }
}
