import "server-only";

import { eq } from "drizzle-orm";

import { getRole } from "@/features/pathway/roles";
import { createDatabase } from "@/server/db/client";
import { learnerPathway } from "@/server/db/schema";

/** The learner's chosen target role, or null when none is set or the stored slug is no longer a seeded role. */
export async function loadTargetRole(userId: string): Promise<string | null> {
  const [row] = await createDatabase().select({ targetRole: learnerPathway.targetRole }).from(learnerPathway).where(eq(learnerPathway.userId, userId)).limit(1);
  return row && getRole(row.targetRole) ? row.targetRole : null;
}

export async function saveTargetRole(userId: string, roleId: string | null): Promise<void> {
  const database = createDatabase();
  if (!roleId) {
    await database.delete(learnerPathway).where(eq(learnerPathway.userId, userId));
    return;
  }
  await database.insert(learnerPathway).values({ userId, targetRole: roleId }).onDuplicateKeyUpdate({ set: { targetRole: roleId } });
}
