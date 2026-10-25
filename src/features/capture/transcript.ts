import type { Segment } from "./types";

export type TranscriptSession = { id: string; number: number; startedAt: string; endedAt: string | null };

export type TranscriptInput = {
  contributorName: string;
  projectTitle: string;
  exportedAt: string;
  sessions: Array<TranscriptSession & { segments: Segment[] }>;
  uploads: Array<{ filename: string; id: string }>;
};

const pad = (n: number): string => String(n).padStart(2, "0");

function offset(from: string, to: string): string {
  const seconds = Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 1000));
  return `${pad(Math.floor(seconds / 3600))}:${pad(Math.floor((seconds % 3600) / 60))}:${pad(seconds % 60)}`;
}

/**
 * The plain-text transcript (`interview_transcript.txt`): verbatim, with session boundaries and timestamps. Corrections the
 * contributor makes later are listed apart so the original words are never overwritten.
 */
export function renderTranscript(input: TranscriptInput): string {
  const out: string[] = [
    "FUTURESKILZ INTERVIEW TRANSCRIPT",
    `Contributor: ${input.contributorName}`,
    `Project: ${input.projectTitle}`,
    `Exported: ${input.exportedAt}`,
    "The companion is an AI. The words below are recorded as spoken or typed and are not edited.",
    "",
  ];
  const corrections: Segment[] = [];
  for (const session of input.sessions) {
    out.push(`==== SESSION ${session.number} — started ${session.startedAt}${session.endedAt ? `, ended ${session.endedAt}` : ", in progress"} ====`, "");
    for (const segment of session.segments) {
      if (segment.source === "correction") {
        corrections.push(segment);
        continue;
      }
      if (segment.source === "upload") continue;
      const who = segment.speaker === "expert" ? "Contributor" : "Companion (AI)";
      out.push(`[${offset(session.startedAt, segment.createdAt)}] ${who}: ${segment.text.trim()}`, "");
    }
    out.push(`==== END OF SESSION ${session.number} ====`, "");
  }
  if (input.uploads.length) {
    out.push("==== UPLOADED MATERIAL (extracted text is kept with the project) ====");
    for (const upload of input.uploads) out.push(`- ${upload.filename}`);
    out.push("");
  }
  if (corrections.length) {
    out.push("==== CONTRIBUTOR CORRECTIONS (added after the interview) ====", "");
    for (const segment of corrections) out.push(`[${segment.createdAt}] Contributor: ${segment.text.trim()}`, "");
  }
  return out.join("\n");
}
