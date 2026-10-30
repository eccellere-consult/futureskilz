"use client";

import { CreateFromInterview } from "@/features/book/ui/BookWorkspace";
import Link from "next/link";
import { useState } from "react";

import type { LessonSummary, listApprovedProjects } from "@/server/capture/lesson-service";

import { formatDuration, messageOf, post, shortDate, useRemote } from "./api";

type Project = Awaited<ReturnType<typeof listApprovedProjects>>[number];

const STATUS: Record<string, string> = { draft: "Draft", in_review: "With an editor", awaiting_contributor: "Waiting for contributor", approved: "Ready to publish", published: "Live", retired: "Retired" };

export function EditorDesk() {
  const [bookFor, setBookFor] = useState<string | null>(null);
  const staff = useRemote<{ projects: Project[] }>("/api/contribute/staff/projects");
  const lessonList = useRemote<{ lessons: LessonSummary[] }>("/api/contribute/lessons");
  const projects = staff.data?.projects ?? null;
  const lessons = lessonList.data?.lessons ?? [];
  const [actionError, setError] = useState<string | null>(null);
  const error = actionError ?? staff.error ?? lessonList.error;
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function generate(project: Project) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await post<{ created: number; updated: number; unchanged: number; skipped: Array<{ topic: string; reason: string }> }>(`/api/contribute/projects/${project.id}/lessons`);
      setNotice(`${project.title}: ${result.created} new, ${result.updated} refreshed, ${result.unchanged} unchanged.${result.skipped.length ? ` Not enough confirmed material for: ${result.skipped.map((s) => `${s.topic} (${s.reason})`).join("; ")}` : ""}`);
      staff.reload();
      lessonList.reload();
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setBusy(false);
    }
  }

  if (!projects) return <div className="mx-auto max-w-3xl px-5 py-16 sm:px-8" role="status">{error ? <p className="text-crimson">{error}</p> : <p className="text-ink-light">Loading…</p>}</div>;

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 lg:py-12">
      <p className="font-mono text-[10px] uppercase text-ink-light">Editor desk</p>
      <h1 className="mt-1 font-display text-4xl font-semibold sm:text-5xl">From approved knowledge to lessons</h1>
      <p className="mt-2 max-w-3xl text-ink-mid">Lessons are built only from statements the contributor confirmed and cleared for sharing. Each one keeps its sources and its credit from the first draft.</p>
      {error ? <p className="mt-3 border-l-2 border-crimson bg-crimson/5 px-4 py-2 text-sm text-crimson" role="alert">{error}</p> : null}
      {notice ? <p className="mt-3 border-l-2 border-teal bg-teal/5 px-4 py-2 text-sm" role="status">{notice}</p> : null}

      <section className="mt-8" aria-label="Approved interviews">
        <h2 className="font-display text-2xl">Approved interviews</h2>
        {projects.length === 0 ? <p className="mt-2 text-sm text-ink-light">None yet. Interviews appear here once the contributor approves them.</p> : null}
        <ul className="mt-3 divide-y divide-border border border-border bg-surface">
          {projects.map((project) => (
            <li key={project.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
              <div><p className="font-semibold">{project.title}</p><p className="text-xs text-ink-light">{project.contributor} · {project.lessons} lesson{project.lessons === 1 ? "" : "s"} drafted, {project.published} live · updated {shortDate(project.updatedAt)}</p></div>
              <div className="flex flex-wrap gap-3">
                <button className="border border-border px-3 py-2 text-sm" aria-expanded={bookFor === project.id} onClick={() => setBookFor(bookFor === project.id ? null : project.id)} type="button">{bookFor === project.id ? "Hide" : "Training and book"}</button>
                <button className="primary-button min-h-10! px-3! py-2!" disabled={busy} onClick={() => void generate(project)} type="button">{project.lessons ? "Refresh lesson drafts" : "Create lesson drafts"}</button>
              </div>
              {bookFor === project.id ? <div className="basis-full border-t border-border pt-4"><CreateFromInterview projectId={project.id} /></div> : null}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10" aria-label="Lessons">
        <h2 className="font-display text-2xl">Lessons</h2>
        <div className="mt-3 overflow-x-auto border border-border bg-surface">
          <table className="w-full min-w-160 text-left text-sm">
            <thead className="border-b border-border font-mono text-[10px] uppercase text-ink-light"><tr><th className="p-3">Lesson</th><th className="p-3">Stage</th><th className="p-3">Length</th><th className="p-3">Status</th><th className="p-3">Checks</th></tr></thead>
            <tbody>
              {lessons.map((lesson) => (
                <tr key={lesson.id} className="border-b border-border last:border-0">
                  <td className="p-3"><Link className="font-semibold underline underline-offset-4" href={`/contribute/lessons/${lesson.id}`}>{lesson.title}</Link><span className="block text-xs text-ink-light">{lesson.roleLabel} · v{lesson.version}</span></td>
                  <td className="p-3">{lesson.stage}<span className="block text-xs text-ink-light">{lesson.proficiency}</span></td>
                  <td className="p-3">{formatDuration(lesson.durationSeconds)}</td>
                  <td className="p-3">{STATUS[lesson.status]}</td>
                  <td className="p-3 text-xs">{lesson.issues.length ? <span className="text-crimson">{lesson.issues.length} to fix</span> : <span className="text-teal">Pass</span>}</td>
                </tr>
              ))}
              {lessons.length === 0 ? <tr><td className="p-3 text-ink-light" colSpan={5}>No lessons yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
