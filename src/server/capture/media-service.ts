import "server-only";

import { createHash } from "node:crypto";

import { and, desc, eq, lt } from "drizzle-orm";

import { MAX_TRANSCRIBE_BYTES, isMediaFile, isVideoFile } from "@/features/intake/media";
import { mediaJobs } from "@/server/db/schema";
import { MediaServiceError, mediaServicesReady, transcribeAudio, type Transcript } from "@/server/providers/openai-media";

import { CaptureError, audit, database, newUuid, requireProject } from "./shared";
import { addReadingUpload, type UploadMeta } from "./upload-service";

/**
 * Recordings. The file is accepted at once and turned into text by the running server in the background, because the host cuts off
 * long requests and a transcript can take minutes; the page polls the job. The transcript then joins the project like any document
 * (same ownership, attestation, review). The recording itself is not kept here. Speakers are not separated.
 */
export type MediaJobView = { id: string; filename: string; status: "queued" | "working" | "done" | "failed"; note: string | null; uploadId: string | null; offsetSeconds: number; updatedAt: string };

export type MediaMeta = { ownership: UploadMeta["ownership"]; attested: boolean; /** Everyone recorded agreed to it being recorded and used for teaching. */ recordingConsent: boolean; offsetSeconds?: number; intendedUse?: string };

/** A running job with no news for this long was lost (the server restarted), so it is marked failed instead of spinning forever. */
const STALE_MS = 12 * 60_000;

/** Replaceable in tests, so the flow can be exercised without the AI service. */
export const transcriber: { ready: () => boolean; run: (bytes: Buffer, filename: string, options: { offsetSeconds: number; label: string }) => Promise<Transcript> } = {
  ready: mediaServicesReady,
  run: (bytes, filename, options) => transcribeAudio(bytes, filename, options),
};

const view = (row: typeof mediaJobs.$inferSelect): MediaJobView => ({ id: row.id, filename: row.filename, status: row.status, note: row.note, uploadId: row.uploadId, offsetSeconds: row.offsetSeconds, updatedAt: row.updatedAt.toISOString() });

export async function startMediaJob(userId: string, projectId: string, file: { name: string; type: string; bytes: Buffer }, meta: MediaMeta): Promise<MediaJobView> {
  const db = await database();
  const project = await requireProject(db, userId, projectId);
  if (!isMediaFile(file.name)) throw new CaptureError(400, "That is not an audio or video file I can read (mp3, m4a, wav, mp4, mov, webm and similar).");
  if (!transcriber.ready()) throw new CaptureError(501, "Transcribing recordings needs an OpenAI key, which is not set on this site yet. Paste a transcript instead, or ask the site owner to add the key.");
  if (project.kind === "source") {
    if (meta.ownership === "unknown") throw new CaptureError(400, "Please say whether this recording is yours, shared with your permission, or someone else's.");
    if (!meta.attested) throw new CaptureError(400, "Please tick the box confirming you may use this material before it is read.");
  }
  if (!meta.recordingConsent) throw new CaptureError(400, "Please confirm that everyone who speaks in this recording agreed to it being recorded and used to make lessons.");
  if (file.bytes.byteLength === 0) throw new CaptureError(400, "That file is empty.");
  if (file.bytes.byteLength > MAX_TRANSCRIBE_BYTES) throw new CaptureError(413, "That recording is larger than 25 MB. Choose it again and I will cut it into parts in your browser; or save it as a smaller audio file.");
  const checksum = createHash("sha256").update(file.bytes).digest("hex");
  const offsetSeconds = Math.max(0, Math.min(Math.floor(meta.offsetSeconds ?? 0), 24 * 3600));

  const [running] = await db.select().from(mediaJobs).where(and(eq(mediaJobs.projectId, projectId), eq(mediaJobs.checksum, checksum))).orderBy(desc(mediaJobs.createdAt)).limit(1);
  if (running && running.status !== "failed") return view(running);

  const id = newUuid();
  await db.insert(mediaJobs).values({ id, projectId, userId, filename: file.name.slice(0, 255), size: file.bytes.byteLength, checksum, offsetSeconds, status: "queued", note: "Waiting to be transcribed.", consentAt: new Date() });
  await audit(db, userId, "media.consent", "project", projectId, { filename: file.name.slice(0, 120), size: file.bytes.byteLength, video: isVideoFile(file.name) });
  void runMediaJob(id, userId, projectId, file, checksum, offsetSeconds, { ownership: meta.ownership, attested: meta.attested, intendedUse: meta.intendedUse, sourceKind: "file" });
  const [row] = await db.select().from(mediaJobs).where(eq(mediaJobs.id, id));
  return view(row);
}

async function runMediaJob(id: string, userId: string, projectId: string, file: { name: string; type: string; bytes: Buffer }, checksum: string, offsetSeconds: number, meta: UploadMeta): Promise<void> {
  const db = await database();
  const settle = (patch: Partial<typeof mediaJobs.$inferInsert>) => db.update(mediaJobs).set(patch).where(eq(mediaJobs.id, id)).catch(() => undefined);
  try {
    await settle({ status: "working", note: "Transcribing. A long recording can take several minutes; you can leave this page." });
    const transcript = await transcriber.run(file.bytes, file.name, { offsetSeconds, label: isVideoFile(file.name) ? "video" : "recording" });
    if (!transcript.pieces.length) {
      await settle({ status: "failed", note: "No speech could be found in this recording. Check that it has sound, or paste a transcript." });
      return;
    }
    const caution = [transcript.timed ? null : "This transcript has no times.", "Speakers are not separated: check who said what."].filter(Boolean).join(" ");
    const result = await addReadingUpload(userId, projectId, { name: file.name, type: file.type || "audio/mpeg", size: file.bytes.byteLength, checksum }, { status: "extracted", pieces: transcript.pieces, note: `Transcribed by AI${transcript.seconds ? ` (${Math.round(transcript.seconds / 60)} min)` : ""}. ${caution}` }, meta);
    await settle({ status: result.status === "failed" ? "failed" : "done", uploadId: result.id || null, note: (result.duplicate ? "You already added this recording." : result.note ?? `Transcribed. ${result.factsAdded} point${result.factsAdded === 1 ? "" : "s"} proposed for review. ${caution}`).slice(0, 500) });
  } catch (error) {
    const note = error instanceof MediaServiceError || error instanceof CaptureError ? error.message : "The recording could not be transcribed. Try again in a few minutes.";
    if (!(error instanceof MediaServiceError || error instanceof CaptureError)) console.error("[media]", error instanceof Error ? error.message : error);
    await settle({ status: "failed", note: note.slice(0, 500) });
  }
}

export async function listMediaJobs(userId: string, projectId: string): Promise<MediaJobView[]> {
  const db = await database();
  await requireProject(db, userId, projectId, { staff: true });
  await db.update(mediaJobs).set({ status: "failed", note: "This was interrupted when the server restarted. Add the recording again." }).where(and(eq(mediaJobs.projectId, projectId), lt(mediaJobs.updatedAt, new Date(Date.now() - STALE_MS)), eq(mediaJobs.status, "working")));
  await db.update(mediaJobs).set({ status: "failed", note: "This was interrupted when the server restarted. Add the recording again." }).where(and(eq(mediaJobs.projectId, projectId), lt(mediaJobs.updatedAt, new Date(Date.now() - STALE_MS)), eq(mediaJobs.status, "queued")));
  return (await db.select().from(mediaJobs).where(eq(mediaJobs.projectId, projectId)).orderBy(desc(mediaJobs.createdAt))).map(view);
}
