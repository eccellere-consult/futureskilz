"use client";

import Link from "next/link";
import { useState } from "react";

import { api, messageOf, patch, post } from "./api";

type Project = { id: string; title: string; status: string };
type Report = { steps: Array<{ step: string; ok: boolean; detail: string }>; started: number; alreadyHad: number; stoppedBecause: string | null };

/**
 * The three things to do with an old interview or source project, right in the list: rename it, let AI turn what is in it into
 * Skill Shots, or delete it. Delete asks once, in place, because it cannot be undone.
 */
export function ProjectActions({ project, onChanged }: { project: Project; onChanged: () => void }) {
  const [mode, setMode] = useState<"idle" | "edit" | "confirm">("idle");
  const [name, setName] = useState(project.title);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "bad"; text: string; link?: boolean } | null>(null);

  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setMessage(null);
    try {
      await work();
    } catch (caught) {
      setMessage({ tone: "bad", text: messageOf(caught) });
    } finally {
      setBusy(false);
    }
  };
  const save = () =>
    run(async () => {
      await patch(`/api/contribute/projects/${project.id}`, { title: name });
      setMode("idle");
      onChanged();
    });
  const fix = () =>
    run(async () => {
      const report = await post<Report>(`/api/contribute/projects/${project.id}/autopilot`, {});
      const problem = report.steps.find((step) => !step.ok);
      if (report.stoppedBecause) setMessage({ tone: "bad", text: report.stoppedBecause });
      else setMessage({ tone: "ok", text: `${report.started} Skill Shot${report.started === 1 ? "" : "s"} started${report.alreadyHad ? `, ${report.alreadyHad} already made` : ""}${problem ? `. ${problem.detail}` : "."}`, link: true });
      onChanged();
    });
  const remove = () =>
    run(async () => {
      await api(`/api/contribute/projects/${project.id}`, { method: "DELETE" });
      onChanged();
    });

  const small = "inline-flex min-h-10 items-center border border-border px-3 text-sm";
  return (
    <>
      {mode === "edit" ? (
        <span className="flex flex-wrap items-center gap-2">
          <input aria-label="Name" className="field-input min-h-10! w-56" maxLength={200} onChange={(event) => setName(event.target.value)} value={name} />
          <button className={small} disabled={busy} onClick={() => void save()} type="button">Save</button>
          <button className="text-sm underline underline-offset-4" onClick={() => { setMode("idle"); setName(project.title); }} type="button">Cancel</button>
        </span>
      ) : mode === "confirm" ? (
        <span className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-crimson">Delete this and everything in it? This cannot be undone.</span>
          <button className={`${small} border-crimson text-crimson`} disabled={busy} onClick={() => void remove()} type="button">{busy ? "Deleting…" : "Yes, delete"}</button>
          <button className="underline underline-offset-4" onClick={() => setMode("idle")} type="button">Keep it</button>
        </span>
      ) : (
        <>
          <button className={small} disabled={busy} onClick={() => setMode("edit")} type="button">Edit</button>
          {project.status !== "withdrawn" ? <button className={small} disabled={busy} onClick={() => void fix()} title="AI turns what is in this into Skill Shots" type="button">{busy ? "Working…" : "Fix with AI"}</button> : null}
          <button className={`${small} text-crimson`} disabled={busy} onClick={() => setMode("confirm")} type="button">Delete</button>
        </>
      )}
      {message ? (
        <span className={`w-full text-xs ${message.tone === "ok" ? "text-teal" : "text-crimson"}`} role="status">
          {message.text} {message.link ? <Link className="underline underline-offset-4" href="/contribute/autopilot">See them</Link> : null}
        </span>
      ) : null}
    </>
  );
}

/** One button for the scrap: every project of yours with nothing confirmed, approved or published. */
export function ClearEmpty({ count, onChanged }: { count: number; onChanged: () => void }) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const clear = async () => {
    setBusy(true);
    try {
      const result = await api<{ removed: number; kept: number }>("/api/contribute/projects", { method: "DELETE" });
      setNote(`${result.removed} deleted${result.kept ? `, ${result.kept} kept because other records use them` : ""}.`);
      setAsking(false);
      onChanged();
    } catch (caught) {
      setNote(messageOf(caught));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mt-3 flex flex-wrap items-center gap-3 border-l-2 border-crimson bg-crimson/5 px-4 py-3 text-sm">
      {asking ? (
        <>
          <span className="text-crimson">Delete all {count} with nothing confirmed? This cannot be undone.</span>
          <button className="primary-button min-h-10! px-3! py-2!" disabled={busy} onClick={() => void clear()} type="button">{busy ? "Deleting…" : "Yes, delete them"}</button>
          <button className="underline underline-offset-4" onClick={() => setAsking(false)} type="button">Keep them</button>
        </>
      ) : (
        <>
          <span>{count} here {count === 1 ? "has" : "have"} nothing confirmed yet (old starts, tests, failed uploads).</span>
          <button className="primary-button min-h-10! px-3! py-2!" onClick={() => setAsking(true)} type="button">Delete all scrap</button>
        </>
      )}
      {note ? <span className="w-full text-xs text-ink-mid" role="status">{note}</span> : null}
    </div>
  );
}
