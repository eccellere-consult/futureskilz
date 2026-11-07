import "server-only";

import { and, asc, eq, inArray } from "drizzle-orm";

import { renderTranscript } from "@/features/capture/transcript";
import { kcContributors, kcSegments, kcSessions, kcUploads } from "@/server/db/schema";

import { database, requireProject, toSegment } from "./shared";

/** `interview_transcript.txt`: verbatim, session by session, with the contributor's later corrections kept apart. */
export async function exportTranscript(userId: string, projectId: string): Promise<{ filename: string; text: string }> {
  const db = await database();
  const project = await requireProject(db, userId, projectId);
  const [contributor] = await db.select().from(kcContributors).where(eq(kcContributors.userId, project.contributorId));
  const sessions = await db.select().from(kcSessions).where(eq(kcSessions.projectId, projectId)).orderBy(asc(kcSessions.number));
  const segments = await db.select().from(kcSegments).where(and(eq(kcSegments.projectId, projectId), inArray(kcSegments.source, ["interview", "correction"]))).orderBy(asc(kcSegments.seq));
  const uploads = await db.select().from(kcUploads).where(eq(kcUploads.projectId, projectId));
  const text = renderTranscript({
    contributorName: contributor?.publicName ?? "Contributor",
    projectTitle: project.title,
    exportedAt: new Date().toISOString(),
    uploads: uploads.map((upload) => ({ id: upload.id, filename: upload.filename })),
    sessions: sessions.map((session) => ({
      id: session.id,
      number: session.number,
      startedAt: session.startedAt.toISOString(),
      endedAt: session.endedAt ? session.endedAt.toISOString() : null,
      segments: segments.filter((segment) => segment.sessionId === session.id || (session.number === 1 && !segment.sessionId)).map(toSegment),
    })),
  });
  return { filename: `interview_transcript_${project.id.slice(0, 8)}.txt`, text };
}
