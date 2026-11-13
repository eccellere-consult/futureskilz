/**
 * Pure helpers for recordings, pictures and the text read from them. No network and no server code, so the rules that decide what
 * is accepted, how a transcript is cut into reviewable pieces and how a time is shown can be tested on their own.
 */

export const AUDIO_EXTENSIONS = [".mp3", ".m4a", ".wav", ".ogg", ".oga", ".flac", ".aac"];
export const VIDEO_EXTENSIONS = [".mp4", ".mov", ".webm", ".mpeg", ".mpga", ".m4v"];
export const MEDIA_EXTENSIONS = [...AUDIO_EXTENSIONS, ...VIDEO_EXTENSIONS];
export const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".gif"];

const endsWithAny = (name: string, list: string[]): boolean => list.some((ext) => name.toLowerCase().endsWith(ext));
export const isMediaFile = (name: string): boolean => endsWithAny(name, MEDIA_EXTENSIONS);
export const isImageFile = (name: string): boolean => endsWithAny(name, IMAGE_EXTENSIONS);
export const isVideoFile = (name: string): boolean => endsWithAny(name, VIDEO_EXTENSIONS);

/** One request to the transcription service takes up to 25 MB. Larger recordings are cut into parts in the person's browser. */
export const MAX_TRANSCRIBE_BYTES = 25 * 1024 * 1024;

/** 0:03:12 for 192 seconds. */
export function formatClock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export type TimedSegment = { start: number; end: number; text: string };
export type TranscriptPiece = { locator: string; text: string };

const PIECE_CHARS = 3500;

/**
 * Groups consecutive spoken segments into pieces of about 3,500 characters, each located by the time range it covers, so a point
 * taken from a recording can say where it was said ("recording 0:03:12-0:04:05"). `offsetSeconds` places a part of a longer recording.
 * `label` is "recording" or "video".
 */
export function piecesFromSegments(segments: TimedSegment[], options: { offsetSeconds?: number; label?: string } = {}): TranscriptPiece[] {
  const offset = options.offsetSeconds ?? 0;
  const label = options.label ?? "recording";
  const pieces: TranscriptPiece[] = [];
  let text = "";
  let start = 0;
  let end = 0;
  const flush = () => {
    const clean = text.replace(/\s+/g, " ").trim();
    if (clean) pieces.push({ locator: `${label} ${formatClock(start + offset)}-${formatClock(end + offset)}`, text: clean });
    text = "";
  };
  for (const segment of segments) {
    const spoken = segment.text.replace(/\s+/g, " ").trim();
    if (!spoken) continue;
    if (text && text.length + spoken.length > PIECE_CHARS) flush();
    if (!text) start = segment.start;
    text += `${text ? " " : ""}${spoken}`;
    end = segment.end;
  }
  flush();
  return pieces;
}

/** Text with no timing (some models return only text): cut on sentence ends into untimed pieces. */
export function piecesFromText(text: string, label = "recording"): TranscriptPiece[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const pieces: TranscriptPiece[] = [];
  let rest = clean;
  while (rest.length) {
    let cut = Math.min(rest.length, PIECE_CHARS);
    if (cut < rest.length) {
      const stop = rest.lastIndexOf(". ", cut);
      if (stop > PIECE_CHARS / 2) cut = stop + 1;
    }
    pieces.push({ locator: pieces.length || rest.length > PIECE_CHARS ? `${label}, part ${pieces.length + 1}` : label, text: rest.slice(0, cut).trim() });
    rest = rest.slice(cut).trim();
  }
  return pieces;
}
