"use client";

import { useState } from "react";

import { messageOf, post, useRemote } from "../../capture/ui/api";

/**
 * One button for the editor: bring every older Skill Shot up to today's rules (consulting-style slides, diagrams, full spoken
 * length). Each is designed again from its own original reference, and replaces the earlier version only when it does at least
 * as well on the checks. Pronunciation fixes need no refresh: they apply to every Skill Shot the moment it is played.
 */
export function RefreshAll({ onStarted }: { onStarted?: () => void }) {
  const { data, error, reload } = useRemote<{ refreshable: number }>("/api/contribute/skill-shots/refresh");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const count = data?.refreshable ?? 0;

  const run = async () => {
    setBusy(true);
    setNote(null);
    try {
      const result = await post<{ queued: number; left: number }>("/api/contribute/skill-shots/refresh");
      setNote({ tone: "ok", text: result.queued ? `${result.queued} being refreshed, one after another (a minute or two each).${result.left ? ` ${result.left} more wait for the next press.` : ""} Each note below says what happened.` : "Nothing needs refreshing." });
      onStarted?.();
      window.setTimeout(reload, 90_000);
    } catch (caught) {
      setNote({ tone: "bad", text: messageOf(caught) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-label="Refresh older Skill Shots" className="mt-8 border border-teal bg-surface p-5">
      <h2 className="font-display text-2xl">Refresh older Skill Shots</h2>
      <p className="mt-1 max-w-3xl text-sm text-ink-mid">Brings every Skill Shot made under older rules up to today&apos;s: headline, subtitle, key points, a picture or diagram and a takeaway on every slide, at full spoken length. A new version replaces the earlier one only when it does at least as well on the checks; otherwise the earlier one is kept. Addresses, status and learners&apos; progress stay as they are.</p>
      {error ? <p className="mt-3 text-sm text-crimson" role="alert">{error}</p> : null}
      {note ? <p className={`mt-3 text-sm ${note.tone === "ok" ? "text-teal" : "text-crimson"}`} role="status">{note.text}</p> : null}
      <button className="primary-button mt-3" disabled={busy || !data || count === 0} onClick={() => void run()} type="button">{busy ? "Starting…" : !data ? "Checking…" : count === 0 ? "All are up to date" : `Refresh all ${count} to the latest format`}</button>
    </section>
  );
}
