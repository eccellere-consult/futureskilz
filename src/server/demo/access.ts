import "server-only";

import { randomUUID, timingSafeEqual } from "node:crypto";

import { eq } from "drizzle-orm";

import { createSessionToken, hashSessionToken } from "@/server/auth/session-token";
import { sessionTtlMs } from "@/server/auth/magic-link";
import { DatabaseMagicLinkRepository } from "@/server/auth/magic-link-repository";
import { createDatabase } from "@/server/db/client";
import { ensureDatabaseSchema } from "@/server/db/ensure-schema";
import { users } from "@/server/db/schema";
import { getServerEnvironment } from "@/server/env";

import { PERSONAS, isDemoEmail, type PersonaId } from "./personas";

export const demoEnabled = (): boolean => !!getServerEnvironment().DEMO_ACCESS_CODE;

const attempts = new Map<string, { count: number; first: number }>();

/** Constant-time check of the owner's demo code, with a small per-address limit against guessing. */
export function checkCode(code: string, ip: string): boolean {
  const expected = getServerEnvironment().DEMO_ACCESS_CODE;
  const now = Date.now();
  const entry = attempts.get(ip);
  if (entry && now - entry.first < 15 * 60_000 && entry.count >= 10) return false;
  const a = Buffer.from(code);
  const b = Buffer.from(expected ?? "");
  const right = !!expected && a.length === b.length && timingSafeEqual(a, b);
  // Only wrong guesses count: building the demo takes about a dozen correct calls in a row, which must never lock the owner out.
  if (right) {
    attempts.delete(ip);
    return true;
  }
  if (!entry || now - entry.first >= 15 * 60_000) attempts.set(ip, { count: 1, first: now });
  else entry.count += 1;
  return false;
}

/** Opens a normal session for a seeded demo person. Only addresses on the reserved demo domain can ever be signed in this way. */
export async function startDemoSession(persona: PersonaId): Promise<{ token: string; expiresAt: Date } | null> {
  const secret = getServerEnvironment().SESSION_SECRET;
  const definition = PERSONAS[persona];
  if (!secret || !definition || !isDemoEmail(definition.email)) return null;
  await ensureDatabaseSchema();
  const db = createDatabase();
  const [user] = await db.select().from(users).where(eq(users.email, definition.email)).limit(1);
  if (!user) return null;
  const sessionId = randomUUID();
  const expiresAt = new Date(Date.now() + sessionTtlMs) // the normal lifetime: a shorter one would be silently renewed (and the cookie swapped) on the first page;
  const token = createSessionToken(sessionId, expiresAt, secret);
  await new DatabaseMagicLinkRepository(db).createSession({ id: sessionId, userId: user.id, tokenHash: hashSessionToken(token), expiresAt });
  return { token, expiresAt };
}

export async function demoSeeded(): Promise<boolean> {
  await ensureDatabaseSchema();
  const rows = await createDatabase().select({ id: users.id }).from(users).where(eq(users.email, PERSONAS.coach.email)).limit(1);
  return rows.length > 0;
}
