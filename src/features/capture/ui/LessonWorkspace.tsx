"use client";

import Link from "next/link";
import { useState } from "react";

import type { LessonAction } from "../lesson-workflow";
import type { LessonDetail } from "@/server/capture/lesson-service";

import { formatDuration, messageOf, patch, post, put, useRemote } from "./api";
import { LessonPlayer } from "./LessonPlayer";

const ACTION_LABEL: Record<LessonAction, { label: string; primary?: boolean }> = {
  submit: { label: "Send to editor review", primary: true },
  editor_approve: { label: "Approve as editor", primary: true },
  request_changes: { label: "Send back for changes" },
  contributor_approve: { label: "Approve this lesson", primary: true },
  contributor_reject: { label: "I want changes" },
  publish: { label: "Publish", primary: true },
  retire: { label: "Retire this lesson" },
};

const STATUS: Record<string, string> = { draft: "Draft", in_review: "With an editor", awaiting_contributor: "Waiting for the contributor", approved: "Approved, ready to publish", published: "Live", retired: "Retired" };

/** One lesson: a preview exactly as learners will see it, the checks it must pass, and the actions the person may take. */
export function LessonWorkspace({ lessonId }: { lessonId: string }) {
  const { data, error, setError, reload } = useRemote<LessonDetail>(`/api/contribute/lessons/${lessonId}`);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState<{ title: string; objective: string; narration: string[] } | null>(null);
  const [shares, setShares] = useState<Array<{ contributorId: string; percent: string }> | null>(null);

  const run = async (work: () => Promise<unknown>, done?: string) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await work();
      if (done) setNotice(done);
      reload();
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setBusy(false);
    }
  };

  if (!data) return <div className="mx-auto max-w-3xl px-5 py-16 sm:px-8" role="status">{error ? <p className="text-crimson">{error}</p> : <p className="text-ink-light">Loading the lesson…</p>}</div>;

  const { summary, spec, gates, attribution } = data;
  const canEditText = summary.actions.includes("submit") || summary.actions.includes("editor_approve") || (summary.status === "draft" || summary.status === "in_review");
  const staff = summary.actions.some((a) => a === "submit" || a === "editor_approve" || a === "publish") || summary.status === "draft";

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 lg:py-12">
      <Link className="text-sm text-teal underline underline-offset-4" href="/contribute/dashboard">Dashboard</Link>
      <p className="mt-3 font-mono text-[10px] uppercase text-ink-light">Lesson · version {summary.version} · {STATUS[summary.status]} · {formatDuration(summary.durationSeconds)}</p>
      <h1 className="font-display text-3xl font-semibold sm:text-4xl">{summary.title}</h1>
      {error ? <p className="mt-3 border-l-2 border-crimson bg-crimson/5 px-4 py-2 text-sm text-crimson" role="alert">{error}</p> : null}
      {notice ? <p className="mt-3 border-l-2 border-teal bg-teal/5 px-4 py-2 text-sm" role="status">{notice}</p> : null}

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="border border-border"><LessonPlayer preview spec={spec} /></div>
        <aside className="space-y-6">
          <section className="border border-ink bg-surface p-4" aria-label="Actions">
            <h2 className="font-display text-xl">What you can do</h2>
            {summary.actions.length === 0 ? <p className="mt-2 text-sm text-ink-light">Nothing needs you right now.</p> : null}
            <div className="mt-3 flex flex-col gap-2">
              {summary.actions.map((action) => (
                <button key={action} className={ACTION_LABEL[action].primary ? "primary-button" : "min-h-11 border border-border px-3 text-sm"} disabled={busy} onClick={() => void run(() => post(`/api/contribute/lessons/${lessonId}`, { action }), `Done: ${ACTION_LABEL[action].label.toLowerCase()}.`)} type="button">{ACTION_LABEL[action].label}</button>
              ))}
            </div>
          </section>

          <section className="border border-border bg-surface p-4 text-sm" aria-label="Checks">
            <h2 className="font-display text-xl">Checks before publishing</h2>
            <ul className="mt-2 space-y-2">
              {gates.map((gate) => (
                <li key={gate.id} className="flex gap-2"><span aria-hidden="true" className={gate.passed ? "text-teal" : "text-crimson"}>{gate.passed ? "✓" : "✕"}</span><span><span className="font-semibold">{gate.label}.</span> <span className="text-ink-mid">{gate.detail}</span></span></li>
              ))}
            </ul>
          </section>

          <section className="border border-border bg-surface p-4 text-sm" aria-label="Credit">
            <h2 className="font-display text-xl">Who is credited</h2>
            <ul className="mt-2 space-y-1">{attribution.map((item) => <li key={item.contributorId}>{item.name}: {(item.shareBp / 100).toFixed(2)}% ({item.creditedAs})</li>)}</ul>
            <p className="mt-2 text-xs text-ink-light">Credit travels with every view and completion of this lesson, so earnings can be shared fairly when several people contributed.</p>
            {staff ? (
              shares ? (
                <div className="mt-3 space-y-2 text-xs">
                  {shares.map((share, index) => (
                    <div key={index} className="flex gap-2"><input aria-label="Contributor id" className="field-input py-1! text-xs" onChange={(event) => setShares(shares.map((s, i) => (i === index ? { ...s, contributorId: event.target.value } : s)))} placeholder="Contributor id" value={share.contributorId} /><input aria-label="Percent" className="field-input w-16 py-1! text-xs" onChange={(event) => setShares(shares.map((s, i) => (i === index ? { ...s, percent: event.target.value } : s)))} value={share.percent} />%</div>
                  ))}
                  <button className="underline underline-offset-4" onClick={() => setShares([...shares, { contributorId: "", percent: "" }])} type="button">Add a contributor</button>
                  <button className="primary-button ml-3 min-h-9! px-3! py-1.5!" disabled={busy} onClick={() => void run(async () => { await put(`/api/contribute/lessons/${lessonId}/attribution`, { shares: shares.map((s) => ({ contributorId: s.contributorId.trim(), shareBp: Math.round(Number(s.percent) * 100) })) }); setShares(null); }, "Credit updated and recorded.")} type="button">Save credit</button>
                </div>
              ) : <button className="mt-2 text-xs text-teal underline underline-offset-4" onClick={() => setShares(attribution.map((a) => ({ contributorId: a.contributorId, percent: String(a.shareBp / 100) })))} type="button">Change credit (editors; admin once approved)</button>
            ) : null}
          </section>

          {canEditText && staff ? (
            <section className="border border-border bg-surface p-4 text-sm" aria-label="Edit wording">
              <h2 className="font-display text-xl">Edit the wording</h2>
              {!edit ? <button className="mt-2 text-teal underline underline-offset-4" onClick={() => setEdit({ title: spec.title, objective: spec.objective, narration: [...spec.narration] })} type="button">Edit title, objective and narration</button> : (
                <div className="mt-2 space-y-2">
                  <label className="block text-xs"><span className="font-mono text-[10px] uppercase text-ink-light">Title</span><input className="field-input py-1.5!" onChange={(event) => setEdit({ ...edit, title: event.target.value })} value={edit.title} /></label>
                  <label className="block text-xs"><span className="font-mono text-[10px] uppercase text-ink-light">Objective (start with a verb such as apply, explain, identify)</span><textarea className="field-input min-h-16" onChange={(event) => setEdit({ ...edit, objective: event.target.value })} value={edit.objective} /></label>
                  {edit.narration.map((paragraph, index) => (
                    <label key={index} className="block text-xs"><span className="font-mono text-[10px] uppercase text-ink-light">Scene {index + 1} narration</span><textarea className="field-input min-h-20" onChange={(event) => setEdit({ ...edit, narration: edit.narration.map((p, i) => (i === index ? event.target.value : p)) })} value={paragraph} /></label>
                  ))}
                  <p className="text-xs text-ink-light">Keep to the contributor&apos;s confirmed facts. Figures not found in them are flagged, and saving clears all approvals.</p>
                  <div className="flex gap-3"><button className="primary-button min-h-10! px-3! py-2!" disabled={busy} onClick={() => void run(async () => { await patch(`/api/contribute/lessons/${lessonId}`, edit); setEdit(null); }, "Saved. Approvals were cleared.")} type="button">Save</button><button className="underline underline-offset-4" onClick={() => setEdit(null)} type="button">Cancel</button></div>
                </div>
              )}
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
