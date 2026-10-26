"use client";

import { Send, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { fetchSessionUser } from "../learner/store";
import type { Blueprint } from "../skillshot/types";
import { COACH_SUGGESTIONS } from "./rules";

type Turn = { role: "learner" | "arya"; text: string; source?: "ai" | "rules" | "safety" };

const WHO: Record<string, string> = { ai: "Arya, AI", rules: "Arya, from the lesson", safety: "Arya" };

/**
 * Ask Arya, inside a Skill Shot: the idea, the steps, an example, a hint for the decision, mistakes to avoid, or the work task.
 * She answers only from this lesson, does not reveal an answer the learner has not given, and says she is an AI. What a signed-in
 * learner writes is saved so editors can check safety and quality; the learner can delete it.
 */
export function AryaCoachPanel({ blueprint, sceneId, answered }: { blueprint: Blueprint; sceneId: string; answered: string[] }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void fetchSessionUser().then((user) => setSignedIn(Boolean(user)));
  }, []);
  useEffect(() => {
    end.current?.scrollIntoView?.({ block: "nearest" });
  }, [turns.length]);

  const send = async (message: string) => {
    const clean = message.trim();
    if (clean.length < 2 || busy) return;
    const history = turns.slice(-4).map(({ role, text: t }) => ({ role, text: t }));
    setTurns((list) => [...list, { role: "learner", text: clean }]);
    setText("");
    setBusy(true);
    setError(null);
    setDeleted(false);
    try {
      const response = await fetch("/api/coach/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ skillShot: blueprint.meta.id, message: clean, sceneId, answered, history }) });
      const data = (await response.json().catch(() => ({}))) as { reply?: string; source?: Turn["source"]; error?: string };
      if (!response.ok || !data.reply) throw new Error(data.error ?? "Arya could not answer just now. Please try again.");
      setTurns((list) => [...list, { role: "arya", text: data.reply!, source: data.source }]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Arya could not answer just now.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    const response = await fetch(`/api/coach/history?skillShot=${encodeURIComponent(blueprint.meta.id)}`, { method: "DELETE" });
    if (response.ok) {
      setTurns([]);
      setDeleted(true);
    }
  };

  return (
    <section aria-label="Ask Arya" className="mt-10 border border-border bg-surface p-5 sm:p-6">
      <p className="font-mono text-[10px] uppercase text-teal">Ask Arya</p>
      <h2 className="mt-1 font-display text-3xl">Stuck, or want it said another way?</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-mid">Arya is an AI. She answers only from this lesson, gives hints and not answers, and asks you to try it in your own words. Please do not share personal details.</p>

      <div aria-live="polite" className="mt-4 max-h-96 space-y-3 overflow-y-auto" role="log">
        {turns.map((turn, index) => (
          <div className={turn.role === "arya" ? "border-l-2 border-gold bg-gold-pale/50 p-3" : "ml-auto max-w-[85%] border border-border bg-cream p-3"} key={index}>
            <p className="font-mono text-[10px] uppercase text-ink-light">{turn.role === "arya" ? WHO[turn.source ?? "ai"] : "You"}</p>
            <p className="mt-1 whitespace-pre-line text-sm leading-6">{turn.text}</p>
          </div>
        ))}
        {busy ? <p className="text-sm text-ink-light" role="status">Arya is thinking…</p> : null}
        <div ref={end} />
      </div>
      {error ? <p className="mt-2 text-sm text-crimson" role="alert">{error}</p> : null}

      <div className="mt-3 flex flex-wrap gap-2">
        {COACH_SUGGESTIONS.map((suggestion) => (
          <button className="border border-border bg-cream px-3 py-1.5 text-xs hover:border-gold disabled:opacity-50" disabled={busy} key={suggestion} onClick={() => void send(suggestion)} type="button">{suggestion}</button>
        ))}
      </div>

      <form className="mt-3 flex gap-2" onSubmit={(event) => { event.preventDefault(); void send(text); }}>
        <label className="sr-only" htmlFor="coach-message">Your question for Arya</label>
        <input className="min-h-11 flex-1 border border-border bg-white px-3 text-sm" id="coach-message" maxLength={600} onChange={(event) => setText(event.target.value)} placeholder="Ask about the idea, a step, or the decision" value={text} />
        <button aria-label="Send" className="primary-button min-h-11! px-4!" disabled={busy || text.trim().length < 2} type="submit"><Send aria-hidden="true" size={16} /></button>
      </form>

      <p className="mt-3 text-xs leading-5 text-ink-light">
        {signedIn ? "Your questions are saved so editors can check that Arya is safe and useful." : "Sign in and your questions are kept with your profile; as a visitor, nothing you ask is saved."}
        {signedIn && turns.length + (deleted ? 1 : 0) > 0 ? <button className="ml-2 inline-flex items-center gap-1 underline underline-offset-4" onClick={() => void remove()} type="button"><Trash2 aria-hidden="true" size={12} />Delete my conversation</button> : null}
        {deleted ? <span className="ml-2 text-teal">Deleted.</span> : null}
      </p>
    </section>
  );
}
