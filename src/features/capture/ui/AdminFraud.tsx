"use client";

import { useState } from "react";

import type { FlagRow } from "@/server/capture/fraud-service";

import { messageOf, patch, post, shortDate, useRemote } from "./api";

const TONE: Record<string, string> = { high: "border-crimson text-crimson", medium: "border-gold", low: "border-border text-ink-mid" };

/** The fraud review queue. Rules raise flags; only an admin's confirmation removes anything from allocations. */
export function AdminFraud() {
  const [status, setStatus] = useState<"open" | "confirmed" | "dismissed">("open");
  const { data, error, setError, reload } = useRemote<{ flags: FlagRow[] }>(`/api/contribute/admin/fraud?status=${status}`);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const run = async (work: () => Promise<string | void>) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const done = await work();
      if (done) setNotice(done);
      reload();
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-label="Fraud review" className="mt-10">
      <h2 className="font-display text-2xl">Fraud review</h2>
      <p className="mt-1 max-w-3xl text-sm text-ink-mid">Simple rules flag activity that looks wrong: authors using their own lessons, lessons finished far too fast, bursts of completions or ratings, ratings from people who did not finish. A flag changes nothing until you confirm it. Confirming a learner flag removes that learner&apos;s activity from allocations; open flags lower a lesson&apos;s trust a little.</p>
      {error ? <p className="mt-3 border-l-2 border-crimson bg-crimson/5 px-4 py-2 text-sm text-crimson" role="alert">{error}</p> : null}
      {notice ? <p className="mt-3 border-l-2 border-teal bg-teal/5 px-4 py-2 text-sm" role="status">{notice}</p> : null}
      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
        <button className="primary-button" disabled={busy} onClick={() => void run(async () => { const r = await post<{ created: number; open: number; checked: { events: number } }>("/api/contribute/admin/fraud"); return `Checked ${r.checked.events} events. ${r.created} new flag${r.created === 1 ? "" : "s"}; ${r.open} open in total.`; })} type="button">Scan the last 60 days</button>
        {(["open", "confirmed", "dismissed"] as const).map((value) => <button key={value} className={`border px-3 py-1.5 ${status === value ? "border-ink bg-ink text-cream" : "border-border"}`} onClick={() => setStatus(value)} type="button">{value}</button>)}
      </div>
      <ul className="mt-4 space-y-3">
        {(data?.flags ?? []).map((flag) => (
          <li key={flag.id} className="border border-border bg-surface p-4 text-sm">
            <div className="flex flex-wrap items-center gap-2 text-[11px]"><span className={`border px-2 py-0.5 ${TONE[flag.severity]}`}>{flag.severity}</span><span className="border border-border px-2 py-0.5">{flag.subjectType}</span><span className="text-ink-light">{shortDate(flag.createdAt)}</span></div>
            <p className="mt-2 font-semibold">{flag.ruleLabel}</p>
            <p className="text-ink-mid">{flag.summary}</p>
            <p className="mt-1 text-xs text-ink-light">{flag.why}</p>
            {flag.status === "open" ? (
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <label className="min-w-60 flex-1 text-xs"><span className="font-mono text-[10px] uppercase text-ink-light">Your note (required)</span><input className="field-input py-1.5! text-sm" value={notes[flag.id] ?? ""} onChange={(event) => setNotes({ ...notes, [flag.id]: event.target.value })} /></label>
                <button className="primary-button" disabled={busy} onClick={() => void run(async () => { await patch(`/api/contribute/admin/fraud/${flag.id}`, { action: "confirm", note: notes[flag.id] ?? "" }); return "Confirmed."; })} type="button">Confirm</button>
                <button className="border border-border px-3 py-2" disabled={busy} onClick={() => void run(async () => { await patch(`/api/contribute/admin/fraud/${flag.id}`, { action: "dismiss", note: notes[flag.id] ?? "" }); return "Dismissed."; })} type="button">Dismiss</button>
              </div>
            ) : <p className="mt-2 text-xs text-ink-mid">{flag.status} · {flag.note}</p>}
          </li>
        ))}
        {data && data.flags.length === 0 ? <li className="text-sm text-ink-light">Nothing {status}.</li> : null}
      </ul>
    </section>
  );
}
