import "server-only";

import { piecesFromSegments, type TranscriptPiece } from "@/features/intake/media";
import { pickTrack, segmentsFromJson3, videoInfo, youtubeId } from "@/features/intake/youtube";
import { CaptureError } from "@/server/capture/shared";

import { fetchGuarded } from "./fetch-url";

export type YoutubeTranscript = { url: string; videoId: string; title: string; author: string; lengthSeconds: number; language: string; automatic: boolean; pieces: TranscriptPiece[] };

const CAPTION_HOST = /(^|\.)youtube\.com$/;

/**
 * The captions of one YouTube video, with times. Allowed only for a video the contributor owns or has permission to teach from (the
 * caller checks); the transcript is read for teaching in new words and the video is cited, never republished. This reads the
 * same captions a viewer sees; it is not an official API, so YouTube can change it, and a video with no captions says so and
 * asks for a pasted transcript or the audio file instead.
 */
export async function fetchYoutubeTranscript(rawUrl: string, preferredLanguage = "en"): Promise<YoutubeTranscript> {
  const id = youtubeId(rawUrl);
  if (!id) throw new CaptureError(400, "That is not a YouTube video address.");
  const watch = `https://www.youtube.com/watch?v=${id}&hl=en`;
  const page = await fetchGuarded(watch, { accept: "text/html", types: /text\/html/i, maxBytes: 4 * 1024 * 1024, headers: { "Accept-Language": "en", Cookie: "CONSENT=YES+1" }, wrongType: "YouTube did not return the video page." });
  const info = videoInfo(page.body);
  if (!info) throw new CaptureError(422, "YouTube did not show this video (it may be private, removed or limited to your country). Paste its transcript instead.");
  if (info.live) throw new CaptureError(422, "This is a live stream. Add it after it ends, or paste the transcript.");
  const track = pickTrack(info.tracks, preferredLanguage);
  if (!track) throw new CaptureError(422, "This video has no captions to read. Paste its transcript, or upload the audio and I will transcribe it.");
  let captionUrl: URL;
  try {
    captionUrl = new URL(track.url);
  } catch {
    throw new CaptureError(422, "The captions could not be located. Paste the transcript instead.");
  }
  if (!CAPTION_HOST.test(captionUrl.hostname)) throw new CaptureError(422, "The captions came from an unexpected place, so they were not read. Paste the transcript instead.");
  captionUrl.searchParams.set("fmt", "json3");
  const captions = await fetchGuarded(captionUrl.toString(), { accept: "application/json", types: /json|text\/plain|javascript/i, maxBytes: 4 * 1024 * 1024, wrongType: "The captions came back in a form I cannot read. Paste the transcript instead." });
  let data: unknown;
  try {
    data = JSON.parse(captions.body);
  } catch {
    throw new CaptureError(422, "The captions came back empty. Paste the transcript instead.");
  }
  const pieces = piecesFromSegments(segmentsFromJson3(data), { label: "video" });
  if (!pieces.length) throw new CaptureError(422, "The captions were empty. Paste the transcript instead.");
  return { url: `https://www.youtube.com/watch?v=${id}`, videoId: id, title: info.title, author: info.author, lengthSeconds: info.lengthSeconds, language: track.language, automatic: track.auto, pieces };
}
