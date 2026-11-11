import "server-only";

import { eq } from "drizzle-orm";

import { kcFacts, kcLessons, kcProjects, kcUploads, skillShotDrafts } from "@/server/db/schema";
import { deleteObject, r2Config } from "@/server/storage/r2";

import { CaptureError, audit, database, requireProject, rolesOf } from "./shared";

/**
 * Housekeeping for the list of interviews and source projects: rename one, delete one, or clear every empty one. Deleting removes the
 * project with its conversation, uploads (and their stored files), statements and documents, and the unpublished Skill Shot drafts made
 * from it. A project with a published lesson is never deleted here: it is withdrawn instead, so learners' records stay whole.
 */
export async function renameProject(userId: string, projectId: string, title: string): Promise<{ title: string }> {
  const clean = title.trim().slice(0, 200);
  if (clean.length < 2) throw new CaptureError(400, "Give it a name of at least two letters.");
  const db = await database();
  await requireProject(db, userId, projectId, { staff: true });
  await db.update(kcProjects).set({ title: clean }).where(eq(kcProjects.id, projectId));
  await audit(db, userId, "project.rename", "project", projectId);
  return { title: clean };
}

async function removeProject(userId: string, projectId: string): Promise<void> {
  const db = await database();
  const lessons = await db.select({ id: kcLessons.id, status: kcLessons.status }).from(kcLessons).where(eq(kcLessons.projectId, projectId));
  if (lessons.some((lesson) => lesson.status === "published")) throw new CaptureError(409, "This one has a published lesson, so it cannot be deleted. Withdraw it from its review page instead.");
  const uploads = await db.select({ key: kcUploads.storageKey }).from(kcUploads).where(eq(kcUploads.projectId, projectId));
  try {
    for (const lesson of lessons) await db.delete(kcLessons).where(eq(kcLessons.id, lesson.id));
    const drafts = await db.select({ id: skillShotDrafts.id, status: skillShotDrafts.status, brief: skillShotDrafts.brief }).from(skillShotDrafts);
    for (const draft of drafts) if ((draft.brief as { sourceProjectId?: string } | null)?.sourceProjectId === projectId && draft.status !== "published") await db.delete(skillShotDrafts).where(eq(skillShotDrafts.id, draft.id));
    await db.delete(kcProjects).where(eq(kcProjects.id, projectId));
  } catch (error) {
    console.error("[project delete]", error instanceof Error ? error.message : error);
    throw new CaptureError(409, "This one is used by other records (for example a lesson learners have opened), so it cannot be deleted. Withdraw it from its review page instead.");
  }
  const config = r2Config();
  if (config) for (const upload of uploads) if (upload.key) await deleteObject(config, upload.key).catch(() => undefined);
  await audit(db, userId, "project.delete", "project", projectId);
}

export async function deleteProject(userId: string, projectId: string): Promise<void> {
  await requireProject(await database(), userId, projectId, { staff: true });
  await removeProject(userId, projectId);
}

/**
 * Clears the scrap in one go: the person's own projects that hold nothing confirmed and are not published (abandoned
 * starts, tests, failed uploads). An editor or admin clears their own list the same way.
 */
export async function deleteEmptyProjects(userId: string): Promise<{ removed: number; kept: number }> {
  const db = await database();
  await rolesOf(db, userId);
  const mine = await db.select().from(kcProjects).where(eq(kcProjects.contributorId, userId));
  let removed = 0;
  let kept = 0;
  for (const project of mine) {
    // "Approved" alone does not protect it: an editor can approve an empty project. Nothing confirmed means nothing to lose.
    if (project.status === "published") continue;
    const facts = await db.select({ status: kcFacts.reviewStatus }).from(kcFacts).where(eq(kcFacts.projectId, project.id));
    if (facts.some((fact) => fact.status === "confirmed" || fact.status === "corrected")) continue;
    try {
      await removeProject(userId, project.id);
      removed += 1;
    } catch {
      kept += 1;
    }
  }
  return { removed, kept };
}
