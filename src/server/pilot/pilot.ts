import "server-only";

import { eq } from "drizzle-orm";

import { CaptureError, audit, database, rolesOf } from "@/server/capture/shared";
import { agentSkills } from "@/server/db/schema";

/**
 * The one-person pilot switch. While it is ON, an editor or admin can run Autopilot: confirm, approve and design in one go, with the
 * approval steps skipped (Skill Shots stop at "approved", which only staff can see, never "published"). It is OFF until an admin turns it
 * on, and turning it off puts every approval step back. Stored in the existing admin-editable settings table, so no database change.
 */
const SLUG = "futureskilz.pilot-mode";

export async function isPilotOn(): Promise<boolean> {
  const db = await database();
  const [row] = await db.select({ value: agentSkills.skillContent }).from(agentSkills).where(eq(agentSkills.agentSlug, SLUG)).limit(1);
  return row?.value === "on";
}

export async function setPilotMode(userId: string, on: boolean): Promise<boolean> {
  const db = await database();
  if (!(await rolesOf(db, userId)).has("admin")) throw new CaptureError(403, "Only an admin can change the pilot switch.");
  const [existing] = await db.select({ id: agentSkills.id }).from(agentSkills).where(eq(agentSkills.agentSlug, SLUG)).limit(1);
  if (existing) await db.update(agentSkills).set({ skillContent: on ? "on" : "off" }).where(eq(agentSkills.id, existing.id));
  else await db.insert(agentSkills).values({ agentSlug: SLUG, name: "Pilot mode (no approvals)", skillContent: on ? "on" : "off" });
  await audit(db, userId, on ? "pilot.on" : "pilot.off", "setting", null);
  return on;
}
