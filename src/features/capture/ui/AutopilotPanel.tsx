"use client";

import { useEffect, useRef, useState } from "react";

import Link from "next/link";

import { api, messageOf, post, put, useRemote } from "./api";

type Report = { steps: Array<{ step: string; ok: boolean; detail: string }>; started: number; alreadyHad: number; unread?: number; stoppedBecause: string | null };

/** The admin's pilot switch. Off by default. While on, Autopilot skips the approval steps for the editor or admin running the pilot. */
export function PilotSwitch() {
  const { data, error, setData } = useRemote<{ on: boolean }>("/api/contribute/pilot");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const toggle = async () => {
    if (!data) return;
    setBusy(true);
    setFailure(null);
    try {
      setData(await put<{ on: boolean }>("/api/contribute/pilot", { on: !data.on }));
    } catch (caught) {
      setFailure(messageOf(caught));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section aria-label="Pilot mode" className="mx-auto mb-8 w-full max-w-6xl border border-border bg-surface p-5 sm:px-8">
      <h2 className="font-display text-xl">Pilot mode: no approvals</h2>
      <p className="mt-1 text-sm text-ink-mid">For the one-person pilot. While this is on, Autopilot confirms, approves and designs Skill Shots in one go. They stop at &ldquo;approved&rdquo;, which only editors and admins can see, and are never published to learners. Turn it off to put every approval step back.</p>
      {error || failure ? <p role="alert" className="mt-3 text-sm text-crimson">{failure ?? error}</p> : null}
      {data ? <button type="button" className="primary-button mt-3" disabled={busy} onClick={() => void toggle()}>{data.on ? "Pilot mode is ON. Turn it off" : "Pilot mode is off. Turn it on"}</button> : null}
    </section>
  );
}

type Draft = { id: string; title: string; status: string; blockers: number; notes: string[] };
const LABEL: Record<string, string> = { designing: "Being designed…", failed: "Could not be made", draft: "Made; open it to finish", in_review: "Made; open it to finish", approved: "Ready", published: "Published", retired: "Retired" };

/** The Skill Shots made from this project, refreshing by itself while any is still being designed. */
function ProjectDrafts({ projectId, quietWhenEmpty }: { projectId: string; quietWhenEmpty?: boolean }) {
  const { data, reload } = useRemote<{ drafts: Draft[] }>(`/api/contribute/projects/${projectId}/autopilot`);
  const working = Boolean(data?.drafts.some((draft) => draft.status === "designing"));
  useEffect(() => {
    if (!working) return;
    const timer = setInterval(reload, 5000);
    return () => clearInterval(timer);
  }, [working, reload]);
  if (!data) return null;
  if (!data.drafts.length) return quietWhenEmpty ? null : <p className="mt-3 text-sm text-ink-mid">Starting…</p>;
  return (
    <ul className="mt-4 divide-y divide-border border border-border text-sm">
      {data.drafts.map((draft) => (
        <li key={draft.id} className="flex flex-wrap items-baseline justify-between gap-2 p-3">
          {draft.status === "designing" ? <span className="font-semibold">{draft.title}</span> : <Link className="font-semibold underline underline-offset-4" href={`/contribute/skill-shots/${draft.id}`}>{draft.title}</Link>}
          <span className={draft.status === "failed" ? "text-crimson" : "text-ink-mid"}>{LABEL[draft.status] ?? draft.status}{draft.status === "draft" && draft.blockers ? ` (${draft.blockers} point${draft.blockers === 1 ? "" : "s"} to fix)` : ""}</span>
          {draft.status === "failed" || (draft.status === "draft" && draft.notes.length) ? <span className="w-full text-xs text-ink-mid">{draft.notes[draft.notes.length - 1]}</span> : null}
        </li>
      ))}
    </ul>
  );
}

/** One button from material to Skill Shot drafts, shown only while the pilot switch is on. Ends with a plain report, never a dead end. */
export function AutopilotPanel({ projectId, autoRunKey, showResults }: { projectId: string; /** Changes when new material has been read: Autopilot then runs by itself. */ autoRunKey?: number; /** Also list the Skill Shots here, so there is no second screen to visit. */ showResults?: boolean }) {
  const { data } = useRemote<{ on: boolean }>("/api/contribute/pilot");
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const ranFor = useRef(0);
  const on = Boolean(data?.on);
  useEffect(() => {
    if (!on || !autoRunKey || ranFor.current === autoRunKey) return;
    ranFor.current = autoRunKey;
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, autoRunKey]);
  if (!on) return null;
  async function run() {
    setBusy(true);
    setFailure(null);
    setReport(null);
    try {
      setReport(await post<Report>(`/api/contribute/projects/${projectId}/autopilot`, {}));
    } catch (caught) {
      setFailure(messageOf(caught));
    } finally {
      setBusy(false);
    }
  }
  async function clearFailed() {
    setBusy(true);
    setFailure(null);
    try {
      await api(`/api/contribute/projects/${projectId}/uploads`, { method: "DELETE", body: JSON.stringify({ allUnread: true }) });
      setReport((current) => (current ? { ...current, unread: 0, steps: [...current.steps, { step: "Remove failed files", ok: true, detail: "Removed. Add them again to retry." }] } : current));
    } catch (caught) {
      setFailure(messageOf(caught));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section aria-label="Autopilot" className="border border-teal bg-surface p-5">
      <h2 className="font-display text-xl">Autopilot (pilot mode)</h2>
      <p className="mt-1 text-sm text-ink-mid">Builds Skill Shots straight from whatever you uploaded, pasted or said. Nothing to confirm or approve first. The ones that pass their checks are marked ready for you; nothing reaches learners.</p>
      {failure ? <p role="alert" className="mt-3 text-sm text-crimson">{failure}</p> : null}
      {report ? (
        <div role="status" className="mt-3 text-sm">
          <ul className="space-y-1">{report.steps.map((step) => <li key={step.step} className={step.ok ? "text-ink" : "text-crimson"}>{step.ok ? "Done" : "Problem"}: {step.step}. {step.detail}</li>)}</ul>
          <p className="mt-2 font-semibold">{report.stoppedBecause ?? `${report.started} Skill Shot${report.started === 1 ? "" : "s"} started${report.alreadyHad ? `, ${report.alreadyHad} already made` : ""}. They take a minute or two each; see the list below.`}</p>
        </div>
      ) : null}
      {report?.unread ? <button type="button" className="mr-2 mt-3 inline-flex min-h-12 items-center border border-crimson px-4 text-sm text-crimson" disabled={busy} onClick={() => void clearFailed()}>Remove the {report.unread} file{report.unread === 1 ? "" : "s"} that could not be read</button> : null}
      <button type="button" className="primary-button mt-3" disabled={busy} onClick={() => void run()}>{busy ? "Working…" : report ? "Run Autopilot again" : "Run Autopilot"}</button>
      {report && !report.stoppedBecause ? <ProjectDrafts projectId={projectId} /> : showResults ? null : <ProjectDrafts projectId={projectId} quietWhenEmpty />}
    </section>
  );
}
