"use client";

import { useState } from "react";

import { messageOf, post, put, useRemote } from "./api";

type Report = { steps: Array<{ step: string; ok: boolean; detail: string }>; started: number; alreadyHad: number; stoppedBecause: string | null };

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

/** One button from material to Skill Shot drafts, shown only while the pilot switch is on. Ends with a plain report, never a dead end. */
export function AutopilotPanel({ projectId }: { projectId: string }) {
  const { data } = useRemote<{ on: boolean }>("/api/contribute/pilot");
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  if (!data?.on) return null;
  const run = async () => {
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
  };
  return (
    <section aria-label="Autopilot" className="border border-teal bg-surface p-5">
      <h2 className="font-display text-xl">Autopilot (pilot mode)</h2>
      <p className="mt-1 text-sm text-ink-mid">Confirms the plain statements, approves the knowledge package and starts a Skill Shot for each teachable piece, in one go. Skill Shots that pass their checks are approved for you to open; nothing reaches learners.</p>
      {failure ? <p role="alert" className="mt-3 text-sm text-crimson">{failure}</p> : null}
      {report ? (
        <div role="status" className="mt-3 text-sm">
          <ul className="space-y-1">{report.steps.map((step) => <li key={step.step} className={step.ok ? "text-ink" : "text-crimson"}>{step.ok ? "Done" : "Problem"}: {step.step}. {step.detail}</li>)}</ul>
          <p className="mt-2 font-semibold">{report.stoppedBecause ?? `${report.started} Skill Shot${report.started === 1 ? "" : "s"} started${report.alreadyHad ? `, ${report.alreadyHad} already made` : ""}. They take a minute or two each; see the list below.`}</p>
        </div>
      ) : null}
      <button type="button" className="primary-button mt-3" disabled={busy} onClick={() => void run()}>{busy ? "Working…" : report ? "Run Autopilot again" : "Run Autopilot"}</button>
    </section>
  );
}
