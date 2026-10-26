"use client";

import { useState } from "react";

import type { Blueprint } from "../skillshot/types";
import { MAX_NOTE_CHARS, MIN_NOTE_WORDS, wordCount, type PracticeFeedback } from "./practice";

const STATUS: Record<string, { label: string; tone: string }> = { met: { label: "Clear", tone: "text-teal" }, partly: { label: "Partly there", tone: "text-gold" }, "not-yet": { label: "Not yet", tone: "text-ink-mid" } };

/**
 * The learner writes how they would use the lesson on a real problem; Arya reads it against the lesson's own success criteria,
 * quotes what she relied on, and suggests one next step for each. It is feedback, not a grade, and it changes no skill level.
 */
export function PracticeNote({ blueprint }: { blueprint: Blueprint }) {
  const [note, setNote] = useState("");
  const [feedback, setFeedback] = useState<(PracticeFeedback & { flag?: string | null }) | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const words = wordCount(note);

  const ask = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/coach/practice", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ skillShot: blueprint.meta.id, note }) });
      const data = (await response.json().catch(() => ({}))) as PracticeFeedback & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Arya could not review your note just now. Please try again.");
      setFeedback(data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Arya could not review your note.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-label="Practice note" className="mt-10 border border-border bg-surface p-5 sm:p-6">
      <p className="font-mono text-[10px] uppercase text-teal">Try it, then ask Arya</p>
      <h2 className="mt-1 font-display text-3xl">Your practice note</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-mid">Write a few sentences on how you would use this on a real problem from your work: what happened, what you did, and what you expect. Arya will read it against what this Skill Shot teaches. Please leave out names and personal details.</p>
      <label className="sr-only" htmlFor="practice-note">Your practice note</label>
      <textarea className="mt-4 min-h-40 w-full border border-border bg-white p-3 text-sm leading-6" id="practice-note" maxLength={MAX_NOTE_CHARS} onChange={(event) => { setNote(event.target.value); setFeedback(null); }} placeholder="Last week, …" value={note} />
      <div className="mt-2 flex flex-wrap items-center gap-4">
        <button className="primary-button" disabled={busy || words < 3} onClick={() => void ask()} type="button">{busy ? "Arya is reading…" : "Ask Arya for feedback"}</button>
        <span className="text-xs text-ink-light">{words} words{words < MIN_NOTE_WORDS ? ` · about ${MIN_NOTE_WORDS} or more gives a useful reading` : ""}</span>
      </div>
      {error ? <p className="mt-3 text-sm text-crimson" role="alert">{error}</p> : null}

      {feedback ? (
        <div aria-live="polite" className="mt-6 border-l-2 border-gold bg-gold-pale/40 p-4" role="region" aria-label="Arya's feedback">
          <p className="font-mono text-[10px] uppercase text-ink-light">Arya&apos;s reading of your note · {feedback.source === "ai" ? "AI-assisted" : "automatic keyword check"}</p>
          <p className="mt-2 text-base leading-7">{feedback.overall}</p>
          {feedback.criteria.length ? (
            <ul className="mt-4 space-y-4">
              {feedback.criteria.map((item) => (
                <li key={item.criterion}>
                  <p className="text-sm font-semibold">{item.criterion} <span className={`ml-1 font-mono text-[10px] uppercase ${STATUS[item.status]?.tone ?? ""}`}>{STATUS[item.status]?.label ?? item.status}</span></p>
                  {item.evidence ? <p className="mt-1 text-sm italic text-ink-mid">You wrote: “{item.evidence}”</p> : null}
                  <p className="mt-1 text-sm text-ink-mid">{item.next}</p>
                </li>
              ))}
            </ul>
          ) : null}
          {feedback.nextStep ? <p className="mt-4 text-sm"><span className="font-semibold">Next step:</span> {feedback.nextStep}</p> : null}
          <p className="mt-4 text-xs leading-5 text-ink-light">This is feedback, not a grade, and it does not change your skill levels. Arya is an AI and can be wrong; you are the judge of your own work.</p>
        </div>
      ) : null}
    </section>
  );
}
