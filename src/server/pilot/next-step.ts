import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import { database, rolesOf } from "@/server/capture/shared";
import { kcLessons, kcProjects, learnerProfiles, skillShotDrafts } from "@/server/db/schema";

import { isPilotOn } from "./pilot";

export type NextStep = { text: string; action: string; href: string };

/**
 * The one thing worth doing next, worked out from the person's own data, so each home opens with a suggestion instead of a menu to
 * read. Counted in code from real rows; nothing here is an AI guess. Returns null when there is nothing useful to say.
 */
export async function nextStepFor(userId: string, persona: string): Promise<NextStep | null> {
  const db = await database();
  const roles = await rolesOf(db, userId);
  const staff = roles.has("editor") || roles.has("admin");

  if ((persona === "editor" || persona === "admin") && staff) {
    const drafts = await db.select({ status: skillShotDrafts.status, brief: skillShotDrafts.brief }).from(skillShotDrafts);
    const auto = drafts.filter((row) => (row.brief as { autopilot?: boolean } | null)?.autopilot);
    const ready = auto.filter((row) => row.status === "approved").length;
    const failed = auto.filter((row) => row.status === "failed").length;
    const working = auto.filter((row) => row.status === "designing").length;
    if (working) return { text: `Autopilot is designing ${working} Skill Shot${working === 1 ? "" : "s"} right now.`, action: "Watch progress", href: "/contribute/autopilot" };
    if (ready) return { text: `${ready} Skill Shot${ready === 1 ? " is" : "s are"} ready for you to open${failed ? `, and ${failed} could not be made` : ""}.`, action: "Open them", href: "/contribute/autopilot" };
    const waiting = await db.select({ id: kcLessons.id }).from(kcLessons).where(eq(kcLessons.status, "in_review"));
    if (waiting.length) return { text: `${waiting.length} lesson${waiting.length === 1 ? " is" : "s are"} waiting for your review.`, action: "Review", href: "/contribute/editor" };
    if (await isPilotOn()) return { text: "Drop in a document and Autopilot turns it into Skill Shots.", action: "Create from files", href: "/contribute/from-source" };
    return null;
  }

  if (persona === "coach") {
    const open = await db.select({ id: kcProjects.id, title: kcProjects.title, status: kcProjects.status, kind: kcProjects.kind }).from(kcProjects).where(and(eq(kcProjects.contributorId, userId), inArray(kcProjects.status, ["interviewing", "in_review"])));
    const review = open.find((project) => project.status === "in_review");
    if (review) return { text: `"${review.title}" is waiting for you to check what was found.`, action: "Check it", href: `/contribute/${review.id}/review` };
    const talking = open.find((project) => project.status === "interviewing" && project.kind !== "source");
    if (talking) return { text: `Your conversation with Arya on "${talking.title}" is not finished.`, action: "Continue", href: `/contribute/${talking.id}` };
    return { text: "Have a document or notes? Turn them into Skill Shots in one step.", action: "Create from files", href: "/contribute/from-source" };
  }

  if (persona === "learner") {
    const [profile] = await db.select({ id: learnerProfiles.userId }).from(learnerProfiles).where(eq(learnerProfiles.userId, userId)).limit(1);
    if (!profile) return { text: "Arya can work out where you stand in about six minutes.", action: "Start with Arya", href: "/assessment" };
    return { text: "Your roadmap shows what to learn first.", action: "Open my roadmap", href: "/journey" };
  }
  return null;
}
