/**
 * Reading a YouTube video's own captions. Pure parsing, so it can be tested on saved page text; the network part is in
 * `src/server/intake/youtube-service.ts`. Used only for a video the contributor owns or has permission to teach from: the captions are
 * re-taught in new words and the video is cited, never republished.
 */
import type { TimedSegment } from "./media";

const ID = /^[A-Za-z0-9_-]{11}$/;

/** The 11-character video id from a watch, short, embed or shorts address, or null when it is not a YouTube video. */
export function youtubeId(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\.|^m\./, "").toLowerCase();
  let id: string | null = null;
  if (host === "youtu.be") id = url.pathname.split("/")[1] ?? null;
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (url.pathname === "/watch") id = url.searchParams.get("v");
    else {
      const match = /^\/(?:embed|shorts|live|v)\/([^/?#]+)/.exec(url.pathname);
      id = match?.[1] ?? null;
    }
  }
  return id && ID.test(id) ? id : null;
}

export type CaptionTrack = { url: string; language: string; auto: boolean; name: string };
export type VideoInfo = { title: string; author: string; lengthSeconds: number; live: boolean; tracks: CaptionTrack[] };

/** The JSON object after `ytInitialPlayerResponse =` in a watch page, found by matching braces so a "}" inside a string does not end it. */
function playerResponse(html: string): Record<string, unknown> | null {
  const marker = html.indexOf("ytInitialPlayerResponse");
  if (marker < 0) return null;
  const open = html.indexOf("{", marker);
  if (open < 0) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = open; i < html.length; i += 1) {
    const ch = html[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(open, i + 1)) as Record<string, unknown>;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

type Raw = { videoDetails?: { title?: string; author?: string; lengthSeconds?: string; isLiveContent?: boolean }; captions?: { playerCaptionsTracklistRenderer?: { captionTracks?: Array<{ baseUrl?: string; languageCode?: string; kind?: string; name?: { simpleText?: string; runs?: Array<{ text?: string }> } }> } } };

export function videoInfo(html: string): VideoInfo | null {
  const data = playerResponse(html) as Raw | null;
  if (!data?.videoDetails) return null;
  const tracks = (data.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? []).flatMap((track) =>
    track.baseUrl && track.languageCode ? [{ url: track.baseUrl, language: track.languageCode, auto: track.kind === "asr", name: track.name?.simpleText ?? track.name?.runs?.map((run) => run.text).join("") ?? track.languageCode }] : [],
  );
  return { title: data.videoDetails.title ?? "YouTube video", author: data.videoDetails.author ?? "", lengthSeconds: Number(data.videoDetails.lengthSeconds ?? 0) || 0, live: !!data.videoDetails.isLiveContent, tracks };
}

/** Prefers a track a person wrote over an automatic one, then English, then the first listed. */
export function pickTrack(tracks: CaptionTrack[], preferred = "en"): CaptionTrack | null {
  if (!tracks.length) return null;
  const score = (track: CaptionTrack) => (track.auto ? 0 : 2) + (track.language.toLowerCase().startsWith(preferred) ? 1 : 0);
  return [...tracks].sort((a, b) => score(b) - score(a))[0];
}

type Json3 = { events?: Array<{ tStartMs?: number; dDurationMs?: number; segs?: Array<{ utf8?: string }> }> };

/** Caption events as timed segments. Line breaks inside a caption become spaces; empty events are dropped. */
export function segmentsFromJson3(data: unknown): TimedSegment[] {
  const events = (data as Json3)?.events ?? [];
  const out: TimedSegment[] = [];
  for (const event of events) {
    const text = (event.segs ?? []).map((seg) => seg.utf8 ?? "").join("").replace(/\s+/g, " ").trim();
    if (!text) continue;
    const start = (event.tStartMs ?? 0) / 1000;
    out.push({ start, end: start + (event.dDurationMs ?? 0) / 1000, text });
  }
  return out;
}
