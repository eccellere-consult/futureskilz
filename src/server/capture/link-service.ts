import "server-only";

import { createHash } from "node:crypto";

import { youtubeId } from "@/features/intake/youtube";
import { fetchPage } from "@/server/intake/fetch-url";
import { fetchYoutubeTranscript } from "@/server/intake/youtube-service";

import { CaptureError, database, requireProject } from "./shared";
import { addReadingUpload, type UploadMeta, type UploadResult } from "./upload-service";
import { MAX_PASTED_CHARS } from "./source-service";

/** Replaceable in tests, so the flow runs without the internet. */
export const fetchers = { page: fetchPage, youtube: fetchYoutubeTranscript };

const slug = (value: string): string => value.replace(/[\\/\u0000-\u001f]/g, "-").replace(/\s+/g, " ").trim().slice(0, 100) || "Web page";

/**
 * A public web page or a YouTube video's captions, read and added like any document, with the address kept as the citation.
 * A web page may be added as your own, with permission, or as someone else's reference (which blocks approval until rights are settled,
 * and lessons must not copy it). YouTube captions are read only for a video you own or may teach from: the person says so, and the
 * system cites the video and re-teaches in new words, never republishing it.
 */
export async function addLinkedSource(userId: string, projectId: string, input: { url: string }, meta: Pick<UploadMeta, "ownership" | "intendedUse" | "attested">): Promise<UploadResult & { kind: "youtube" | "page"; title: string }> {
  const db = await database();
  const project = await requireProject(db, userId, projectId);
  if (project.kind === "source") {
    if (meta.ownership === "unknown") throw new CaptureError(400, "Please say whether this material is yours, shared with your permission, or someone else's.");
    if (!meta.attested) throw new CaptureError(400, "Please tick the box confirming you may use this material before it is read.");
  }
  const address = input.url.trim();
  if (!address) throw new CaptureError(400, "Paste a web address first.");

  if (youtubeId(address)) {
    if (meta.ownership !== "mine" && meta.ownership !== "permission") throw new CaptureError(422, "I read a video's captions only when the video is yours or you have the owner's permission to teach from it. Choose that, or paste the transcript yourself.");
    const video = await fetchers.youtube(address);
    const text = video.pieces.map((piece) => piece.text).join("\n");
    const checksum = createHash("sha256").update(`youtube:${video.videoId}:${video.language}:${text.length}`).digest("hex");
    const note = `Captions of "${video.title}"${video.author ? ` by ${video.author}` : ""} (${video.automatic ? "automatic captions, so check the wording" : "written captions"}, ${video.language}).`;
    const result = await addReadingUpload(userId, projectId, { name: `${slug(video.title)}.txt`, type: "text/youtube-captions", size: text.length, checksum }, { status: "extracted", pieces: video.pieces, note }, { ...meta, sourceKind: "link_text", sourceUrl: video.url });
    return { ...result, kind: "youtube", title: video.title };
  }

  const page = await fetchers.page(address);
  const text = page.text.length > MAX_PASTED_CHARS ? page.text.slice(0, MAX_PASTED_CHARS) : page.text;
  const cut = page.text.length > text.length ? ` Only the first ${MAX_PASTED_CHARS.toLocaleString("en-IN")} of ${page.text.length.toLocaleString("en-IN")} characters were read.` : "";
  const checksum = createHash("sha256").update(text).digest("hex");
  const pieces = splitPage(text);
  const result = await addReadingUpload(userId, projectId, { name: `${slug(page.title ?? new URL(page.url).hostname)}.txt`, type: "text/web-page", size: text.length, checksum }, { status: "extracted", pieces, note: `Read from the web page ${page.url}.${cut}` }, { ...meta, sourceKind: "link_text", sourceUrl: page.url });
  return { ...result, kind: "page", title: page.title ?? new URL(page.url).hostname };
}

/** A page is read in parts of about 4,000 characters, split on paragraphs, each located as "web page" or "web page, part n". */
export function splitPage(text: string): Array<{ locator: string; text: string }> {
  const chunks: string[] = [];
  let current = "";
  for (const paragraph of text.split(/\n{2,}/)) {
    if (current && current.length + paragraph.length > 4000) {
      chunks.push(current.trim());
      current = "";
    }
    current += `${current ? "\n\n" : ""}${paragraph}`;
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.map((chunk, index) => ({ locator: chunks.length > 1 ? `web page, part ${index + 1}` : "web page", text: chunk }));
}
