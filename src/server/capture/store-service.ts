import "server-only";

import { CaptureError, database, requireProject } from "./shared";
import { addStoredOnly, addUpload, type UploadMeta, type UploadResult } from "./upload-service";
import { MAX_READ_BYTES } from "./upload-text";
import { MAX_STORED_BYTES, deleteObject, getObjectBytes, headObject, keyBelongsTo, presignedPut, r2Config, storageKeyFor } from "@/server/storage/r2";

/**
 * Big files go from the person's browser straight to the private file store: this site only signs a short-lived upload
 * link, then reads the file back when it is small enough to read. If the store is not set up, callers fall back to the
 * ordinary upload (25 MB).
 */
const OWNERSHIP: UploadMeta["ownership"][] = ["mine", "permission", "third_party", "unknown"];
const SIGN_SECONDS = 1800;

async function gate(userId: string, projectId: string, ownership: UploadMeta["ownership"], attested: boolean) {
  const db = await database();
  const project = await requireProject(db, userId, projectId);
  if (project.kind === "source") {
    if (ownership === "unknown") throw new CaptureError(400, "Please say whether this material is yours, shared with your permission, or someone else's.");
    if (!attested) throw new CaptureError(400, "Please tick the box confirming you may use this material before it is read.");
  }
}

export const cleanOwnership = (value: unknown): UploadMeta["ownership"] => OWNERSHIP.find((item) => item === value) ?? "unknown";

export function storeIsReady(): boolean {
  return r2Config() !== null;
}

export async function signUpload(userId: string, projectId: string, input: { filename: string; size: number; ownership: UploadMeta["ownership"]; attested: boolean }): Promise<{ key: string; url: string; expiresIn: number }> {
  const config = r2Config();
  if (!config) throw new CaptureError(501, "The file store is not set up yet.");
  await gate(userId, projectId, input.ownership, input.attested);
  if (!Number.isFinite(input.size) || input.size <= 0) throw new CaptureError(400, "That file is empty.");
  if (input.size > MAX_STORED_BYTES) throw new CaptureError(413, "That file is larger than 5 GB. Split it into parts.");
  const key = storageKeyFor(projectId, input.filename);
  return { key, url: presignedPut(config, key, SIGN_SECONDS), expiresIn: SIGN_SECONDS };
}

/** After the browser has sent the file: read it if small enough, otherwise record it as stored and not yet read. */
export async function registerUpload(userId: string, projectId: string, input: { key: string; filename: string; type: string; ownership: UploadMeta["ownership"]; attested: boolean }): Promise<UploadResult> {
  const config = r2Config();
  if (!config) throw new CaptureError(501, "The file store is not set up yet.");
  await gate(userId, projectId, input.ownership, input.attested);
  if (!keyBelongsTo(input.key, projectId)) throw new CaptureError(400, "That file does not belong to this project.");
  const head = await headObject(config, input.key).catch(() => {
    throw new CaptureError(502, "The file store did not answer. Please try again.");
  });
  if (!head) throw new CaptureError(404, "The file did not arrive. Please try again.");
  if (head.size === 0) {
    await deleteObject(config, input.key).catch(() => undefined);
    throw new CaptureError(400, "That file is empty.");
  }
  const meta: UploadMeta = { ownership: input.ownership, attested: input.attested, storageKey: input.key };
  if (head.size > MAX_READ_BYTES) return addStoredOnly(userId, projectId, { name: input.filename, type: input.type, size: head.size, storageKey: input.key }, meta);

  const bytes = await getObjectBytes(config, input.key).catch(() => {
    throw new CaptureError(502, "The file store did not answer. Please try again.");
  });
  const result = await addUpload(userId, projectId, { name: input.filename, type: input.type, bytes }, meta);
  // The same file was already added: keep one copy, not two.
  if (result.duplicate) await deleteObject(config, input.key).catch(() => undefined);
  return result;
}
