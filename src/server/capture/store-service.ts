import "server-only";

import { CaptureError, database, requireProject } from "./shared";
import { addPreReadUpload, addStoredOnly, addUpload, type UploadMeta, type UploadResult } from "./upload-service";
import { MAX_PRE_READ_CHARS, MAX_PRE_READ_PAGES, MAX_READ_BYTES } from "./upload-text";
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

/**
 * A PDF whose text the browser has already read. The pages arrive as text; the original may also have been sent to the file
 * store (its key is then checked to belong to this project and to exist), or not kept at all when there is no file store.
 */
export async function registerPreRead(
  userId: string,
  projectId: string,
  input: { filename: string; type: string; size: number; checksum: string; pages: unknown; ownership: UploadMeta["ownership"]; attested: boolean; key: string },
): Promise<UploadResult> {
  await gate(userId, projectId, input.ownership, input.attested);
  if (!/^[a-f0-9]{64}$/.test(input.checksum)) throw new CaptureError(400, "The file could not be checked. Please try again.");
  if (!Array.isArray(input.pages) || input.pages.length > MAX_PRE_READ_PAGES) throw new CaptureError(413, `Please add PDFs of up to ${MAX_PRE_READ_PAGES} pages, or split this one.`);
  let chars = 0;
  const pages = input.pages.flatMap((page, index) => {
    const text = typeof (page as { text?: unknown })?.text === "string" ? (page as { text: string }).text : "";
    chars += text.length;
    return text.trim() ? [{ num: Number.isInteger((page as { num?: unknown }).num) ? Number((page as { num: number }).num) : index + 1, text }] : [];
  });
  if (chars > MAX_PRE_READ_CHARS) throw new CaptureError(413, "That PDF has too much text for one file. Split it into parts.");
  let storageKey: string | null = null;
  if (input.key) {
    const config = r2Config();
    if (!config) throw new CaptureError(501, "The file store is not set up yet.");
    if (!keyBelongsTo(input.key, projectId)) throw new CaptureError(400, "That file does not belong to this project.");
    const head = await headObject(config, input.key).catch(() => {
      throw new CaptureError(502, "The file store did not answer. Please try again.");
    });
    if (!head) throw new CaptureError(404, "The file did not arrive. Please try again.");
    storageKey = input.key;
  }
  const result = await addPreReadUpload(userId, projectId, { name: input.filename, type: input.type, size: input.size, checksum: input.checksum, pages, storageKey }, { ownership: input.ownership, attested: input.attested });
  const config = r2Config();
  if (result.duplicate && storageKey && config) await deleteObject(config, storageKey).catch(() => undefined);
  return result;
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
