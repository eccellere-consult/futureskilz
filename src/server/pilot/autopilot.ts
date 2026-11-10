import "server-only";

import { eq } from "drizzle-orm";

import { CaptureError, database, requireProject, rolesOf } from "@/server/capture/shared";
import { approvePackage, confirmAllPlain, generateDraft } from "@/server/capture/review-service";
import { kcUploads } from "@/server/db/schema";
import { designFromMaterial } from "@/server/skillshots/service";

import { isPilotOn } from "./pilot";

/** The most Skill Shots one Autopilot run starts. It keeps AI cost predictable; run it again for the rest. */
export const AUTOPILOT_LIMIT = 12;

export type AutopilotReport = {
  steps: Array<{ step: string; ok: boolean; detail: string }>;
  started: number;
  alreadyHad: number;
  /** Files in the project that were not read. The screen offers to remove them in one click. */
  unread: number;
  /** The plain reason nothing was started, when that is so. */
  stoppedBecause: string | null;
};

/**
 * One call from material to Skill Shot drafts, for the one-person pilot. It confirms the plain statements, builds and approves the knowledge
 * package, and starts a design for each teachable piece. A step that fails is retried once and then reported, never left as a dead end;
 * the run always ends with a plain report. Drafts that pass the checks stop at "approved", which only staff can see.
 */
export async function runAutopilot(userId: string, projectId: string): Promise<AutopilotReport> {
  if (!(await isPilotOn())) throw new CaptureError(409, "Autopilot is off. An admin can turn the pilot switch on.");
  const db = await database();
  const roles = await rolesOf(db, userId);
  if (!roles.has("editor") && !roles.has("admin")) throw new CaptureError(403, "Autopilot is for the editor or admin running the pilot.");
  await requireProject(db, userId, projectId, { staff: true });

  const report: AutopilotReport = { steps: [], started: 0, alreadyHad: 0, unread: 0, stoppedBecause: null };
  const attempt = async <T,>(step: string, work: () => Promise<T>, describe: (value: T) => string): Promise<T | null> => {
    for (let tries = 1; tries <= 2; tries += 1) {
      try {
        const value = await work();
        report.steps.push({ step, ok: true, detail: describe(value) });
        return value;
      } catch (error) {
        if (tries === 2) report.steps.push({ step, ok: false, detail: error instanceof Error ? error.message : "Something went wrong." });
      }
    }
    return null;
  };

  const uploads = await db.select({ name: kcUploads.filename, status: kcUploads.extractionStatus }).from(kcUploads).where(eq(kcUploads.projectId, projectId));
  const unread = uploads.filter((upload) => upload.status !== "extracted" && upload.status !== "duplicate");
  report.unread = unread.length;
  report.steps.push({ step: "Material", ok: true, detail: `${uploads.length - unread.length} file${uploads.length - unread.length === 1 ? "" : "s"} read${unread.length ? `; skipped ${unread.length} that could not be read (${unread.slice(0, 3).map((upload) => upload.name).join(", ")})` : ""}.` });

  // The direct route: Skill Shots straight from the text that was read or said. Nothing has to be confirmed, packaged or approved first.
  const designed = await attempt("Design the Skill Shots from the material", () => designFromMaterial(userId, projectId, AUTOPILOT_LIMIT), (value) => (value.queued || value.alreadyStarted ? `${value.queued} started${value.alreadyStarted ? `, ${value.alreadyStarted} already made` : ""}, from ${value.chars.toLocaleString("en-IN")} characters of text. Each takes a minute or two.` : `Only ${value.chars} characters of readable text were found.`));
  if (!designed) return { ...report, stoppedBecause: "The Skill Shots could not be started. See the step above." };
  report.started = designed.queued;
  report.alreadyHad = designed.alreadyStarted;
  if (!designed.queued && !designed.alreadyStarted) {
    report.stoppedBecause = unread.length
      ? "There is no readable text yet. Remove the file that could not be read and add it again (PDFs are read in your browser), or paste its text. Autopilot then runs by itself."
      : "There is no readable text yet. Add a file or paste text. Autopilot then runs by itself.";
    return report;
  }

  // Extra, never in the way: the statements are also confirmed and packaged for the review page. A failure here does not stop anything.
  await confirmAllPlain(userId, projectId).catch(() => undefined);
  await generateDraft(userId, projectId).catch(() => undefined);
  await approvePackage(userId, projectId).catch(() => undefined);
  return report;
}
