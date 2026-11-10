import "server-only";

import { eq } from "drizzle-orm";

import { CaptureError, database, requireProject, rolesOf } from "@/server/capture/shared";
import { approvePackage, confirmAllPlain, generateDraft } from "@/server/capture/review-service";
import { kcUploads } from "@/server/db/schema";
import { designFromProject } from "@/server/skillshots/service";

import { isPilotOn } from "./pilot";

/** The most Skill Shots one Autopilot run starts. It keeps AI cost predictable; run it again for the rest. */
export const AUTOPILOT_LIMIT = 12;

export type AutopilotReport = {
  steps: Array<{ step: string; ok: boolean; detail: string }>;
  started: number;
  alreadyHad: number;
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

  const report: AutopilotReport = { steps: [], started: 0, alreadyHad: 0, stoppedBecause: null };
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
  report.steps.push({ step: "Material", ok: true, detail: `${uploads.length - unread.length} file${uploads.length - unread.length === 1 ? "" : "s"} read${unread.length ? `; skipped ${unread.length} that could not be read (${unread.slice(0, 3).map((upload) => upload.name).join(", ")})` : ""}.` });

  await attempt("Confirm the plain statements", () => confirmAllPlain(userId, projectId), (value) => `${value.confirmed} confirmed${value.skipped ? `, ${value.skipped} sensitive ones left out` : ""}.`);
  const drafted = await attempt("Build the knowledge package", () => generateDraft(userId, projectId), (value) => `${value.stats.included} statements in the package.`);
  if (!drafted) return { ...report, stoppedBecause: "The knowledge package could not be built. See the step above." };
  if (!drafted.stats.included) return { ...report, stoppedBecause: unread.length ? "There is no readable material yet. Remove the file that could not be read, add it again (PDFs are read in your browser), or paste its text, then run Autopilot again." : "There is no readable material yet. Add a file or paste text, then run Autopilot again." };
  const approved = await attempt("Approve the package", () => approvePackage(userId, projectId), (value) => (value.approved ? "Approved." : "Not approved."));
  if (!approved?.approved) return { ...report, stoppedBecause: "The package could not be approved. See the step above." };

  const designed = await attempt("Design the Skill Shots", () => designFromProject(userId, projectId, undefined, { autopilot: true, limit: AUTOPILOT_LIMIT }), (value) => `${value.queued} started${value.alreadyStarted ? `, ${value.alreadyStarted} already made` : ""}. Each stops at approved when its checks pass.`);
  if (!designed) return { ...report, stoppedBecause: "No Skill Shots could be started. See the step above." };
  report.started = designed.queued;
  report.alreadyHad = designed.alreadyStarted;
  if (!designed.queued && !designed.alreadyStarted) report.stoppedBecause = "There is not enough confirmed knowledge to make a Skill Shot from yet.";
  return report;
}
