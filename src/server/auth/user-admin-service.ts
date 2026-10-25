import "server-only";

import { desc, eq, inArray, like, or } from "drizzle-orm";

import { CaptureError, audit, database, rolesOf } from "@/server/capture/shared";
import { userCredentials, userRoles, userSessions, users } from "@/server/db/schema";

import { generatePassword } from "./password";
import { normalizeEmail, setPassword } from "./password-service";

export const ASSIGNABLE_ROLES = ["learner", "contributor", "editor", "admin"] as const;
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

async function requireAdmin(userId: string) {
  const db = await database();
  if (!(await rolesOf(db, userId)).has("admin")) throw new CaptureError(403, "Only an admin can manage accounts.");
  return db;
}

const cleanRoles = (roles: unknown): AssignableRole[] => {
  const picked = Array.isArray(roles) ? ASSIGNABLE_ROLES.filter((role) => roles.includes(role)) : [];
  // Anyone who can edit or administer can also read lessons as a learner; "learner" is implied and always kept.
  return Array.from(new Set<AssignableRole>(["learner", ...picked]));
};

export type ManagedUser = { id: string; email: string; name: string; status: string; roles: string[]; hasPassword: boolean; locked: boolean; createdAt: string };

export async function listUsers(adminId: string, query = ""): Promise<ManagedUser[]> {
  const db = await requireAdmin(adminId);
  const q = query.trim().toLowerCase();
  const rows = await db
    .select({ id: users.id, email: users.email, name: users.displayName, status: users.status, createdAt: users.createdAt })
    .from(users)
    .where(q ? or(like(users.email, `%${q}%`), like(users.displayName, `%${q}%`)) : undefined)
    .orderBy(desc(users.createdAt))
    .limit(200);
  if (rows.length === 0) return [];
  const ids = rows.map((row) => row.id);
  const [roles, credentials] = await Promise.all([
    db.select().from(userRoles).where(inArray(userRoles.userId, ids)),
    db.select({ userId: userCredentials.userId, lockedUntil: userCredentials.lockedUntil }).from(userCredentials).where(inArray(userCredentials.userId, ids)),
  ]);
  return rows.map((row) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
    roles: roles.filter((r) => r.userId === row.id).map((r) => r.role),
    hasPassword: credentials.some((c) => c.userId === row.id),
    locked: credentials.some((c) => c.userId === row.id && !!c.lockedUntil && c.lockedUntil.getTime() > Date.now()),
  }));
}

export type CreatedUser = { id: string; email: string; roles: string[]; password: string };

/** Creates an account with a password. The password is returned once, here; afterwards only its hash exists. */
export async function createUser(adminId: string, input: { email: string; name: string; roles: unknown; password?: string }): Promise<CreatedUser> {
  const db = await requireAdmin(adminId);
  const email = normalizeEmail(input.email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new CaptureError(400, "Enter a valid email address.");
  const name = input.name.trim().slice(0, 160) || email.split("@")[0];
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing) throw new CaptureError(409, "An account with that email already exists. Reset its password or change its roles instead.");
  const roles = cleanRoles(input.roles);
  const password = input.password?.trim() || generatePassword();
  const id = crypto.randomUUID();
  await db.insert(users).values({ id, email, displayName: name, status: "active" });
  for (const role of roles) await db.insert(userRoles).values({ userId: id, role });
  try {
    await setPassword(id, password, adminId);
  } catch (error) {
    await db.delete(users).where(eq(users.id, id));
    throw new CaptureError(400, error instanceof Error ? error.message : "That password cannot be used.");
  }
  await audit(db, adminId, "user.create", "user", id, { email, roles });
  return { id, email, roles, password };
}

export async function resetPassword(adminId: string, userId: string, password?: string): Promise<{ password: string }> {
  const db = await requireAdmin(adminId);
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new CaptureError(404, "That account was not found.");
  const next = password?.trim() || generatePassword();
  try {
    await setPassword(userId, next, adminId);
  } catch (error) {
    throw new CaptureError(400, error instanceof Error ? error.message : "That password cannot be used.");
  }
  // A new password ends every session signed in with the old one.
  await db.update(userSessions).set({ revokedAt: new Date() }).where(eq(userSessions.userId, userId));
  await audit(db, adminId, "user.password_reset", "user", userId);
  return { password: next };
}

export async function setUserStatus(adminId: string, userId: string, status: "active" | "suspended"): Promise<void> {
  const db = await requireAdmin(adminId);
  if (userId === adminId) throw new CaptureError(409, "You cannot suspend your own account.");
  await db.update(users).set({ status }).where(eq(users.id, userId));
  if (status === "suspended") await db.update(userSessions).set({ revokedAt: new Date() }).where(eq(userSessions.userId, userId));
  await audit(db, adminId, `user.${status}`, "user", userId);
}

export async function setUserRoles(adminId: string, userId: string, roles: unknown): Promise<string[]> {
  const db = await requireAdmin(adminId);
  const next = cleanRoles(roles);
  if (userId === adminId && !next.includes("admin")) throw new CaptureError(409, "You cannot remove your own admin role.");
  await db.delete(userRoles).where(eq(userRoles.userId, userId));
  for (const role of next) await db.insert(userRoles).values({ userId, role });
  await audit(db, adminId, "user.roles", "user", userId, { roles: next });
  return next;
}
