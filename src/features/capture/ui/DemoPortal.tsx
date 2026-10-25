"use client";

import { useState } from "react";

import { messageOf, post, useRemote } from "./api";

type Persona = { id: string; name: string; email: string; summary: string; tour: Array<[string, string]> };

const PERSONAS: Persona[] = [
  {
    id: "learner", name: "Meera Iyer · Learner", email: "demo.learner@demo.futureskilz.test",
    summary: "A production planner early in their career.",
    tour: [["/learn", "My learning: skills, training kits and coach lessons in one place"], ["/journey", "Her personal journey and completed Skill Shots"], ["/problem-solving", "Training kit: a worked problem on late changes to the frozen plan"], ["/lessons", "Learning paths built from the coach's lessons"]],
  },
  {
    id: "coach", name: "Asha Rao · Coach", email: "demo.coach@demo.futureskilz.test",
    summary: "A retired plant leader whose interview became published lessons.",
    tour: [["/contribute/dashboard", "Lessons, learner usage and the earnings preview"], ["/contribute", "Her interviews"], ["/contribute/dashboard", "Open the lesson waiting for her approval"]],
  },
  {
    id: "editor", name: "Edith Nair · Editor", email: "demo.editor@demo.futureskilz.test",
    summary: "Turns approved knowledge into lessons and reviews them.",
    tour: [["/contribute/editor", "The approved interview and the lesson queue"], ["/contribute/editor", "Open a lesson: preview, checks, wording, credit"]],
  },
  {
    id: "admin", name: "Adam Khan · Admin", email: "demo.admin@demo.futureskilz.test",
    summary: "Owns the revenue-share rules and statements.",
    tour: [["/contribute/admin", "The demo policy, receipts and an allocation run"], ["/contribute/admin", "Press Approve on the demo policy, then Calculate again for a payable statement"]],
  },
];

/** A guided way in for demonstrations. It needs the access code the site owner set, and only opens the sample people. */
export function DemoPortal() {
  const status = useRemote<{ enabled: boolean; seeded?: boolean }>("/api/demo/seed");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [steps, setSteps] = useState<string[]>([]);

  async function seed(action: "seed" | "retire") {
    setBusy(action);
    setError(null);
    setSteps([]);
    try {
      const result = await post<{ steps?: string[]; retired?: number }>("/api/demo/seed", { code, action });
      setSteps(action === "seed" ? (result.steps ?? []) : [`Retired ${result.retired ?? 0} demo interview(s) and their lessons.`]);
      status.reload();
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setBusy(null);
    }
  }

  async function enter(persona: string) {
    setBusy(persona);
    setError(null);
    try {
      const result = await post<{ redirectPath: string }>("/api/demo/login", { code, persona });
      window.location.assign(result.redirectPath);
    } catch (caught) {
      setError(messageOf(caught));
      setBusy(null);
    }
  }

  if (status.data && !status.data.enabled) {
    return <div className="mx-auto max-w-2xl px-5 py-20 sm:px-8"><h1 className="font-display text-4xl">The demo is switched off.</h1><p className="mt-3 text-ink-mid">The site owner turns it on by setting an access code. Until then this page does nothing.</p></div>;
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-12 sm:px-8 sm:py-16">
      <p className="font-mono text-[10px] uppercase text-gold">Demonstration</p>
      <h1 className="mt-2 font-display text-5xl font-semibold leading-tight">Walk through FutureSkilz as each person.</h1>
      <p className="mt-3 max-w-2xl text-lg leading-8 text-ink-mid">Sample people with one finished example each. Everything is made by the real product, not mock-ups. Sample lessons are labelled and can be retired afterwards.</p>

      <section className="mt-8 max-w-md border-t-2 border-gold bg-surface p-5" aria-label="Access">
        <label className="font-mono text-[10px] uppercase text-ink-light" htmlFor="code">Demo access code</label>
        <input autoComplete="off" className="field-input" id="code" onChange={(event) => setCode(event.target.value)} type="password" value={code} />
        <div className="mt-3 flex flex-wrap gap-3">
          <button className="primary-button" disabled={!code || !!busy} onClick={() => void seed("seed")} type="button">{busy === "seed" ? "Setting up (about a minute)…" : status.data?.seeded ? "Rebuild the demo" : "Set up the demo"}</button>
          <button className="min-h-12 border border-border px-4 text-sm" disabled={!code || !!busy} onClick={() => void seed("retire")} type="button">Retire the demo</button>
        </div>
        {error ? <p className="mt-3 text-sm text-crimson" role="alert">{error}</p> : null}
        {steps.length ? <ul className="mt-3 space-y-1 text-xs text-ink-mid" role="status">{steps.map((step) => <li key={step}>✓ {step}</li>)}</ul> : null}
      </section>

      <div className="mt-10 grid gap-5 sm:grid-cols-2">
        {PERSONAS.map((persona) => (
          <section key={persona.id} className="border border-border bg-surface p-5" aria-label={persona.name}>
            <h2 className="font-display text-2xl">{persona.name}</h2>
            <p className="font-mono text-[11px] text-ink-light">{persona.email}</p>
            <p className="mt-2 text-sm text-ink-mid">{persona.summary}</p>
            <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm">{persona.tour.map(([, label]) => <li key={label}>{label}</li>)}</ol>
            <button className="primary-button mt-4" disabled={!code || !!busy || !status.data?.seeded} onClick={() => void enter(persona.id)} type="button">{busy === persona.id ? "Opening…" : `Enter as ${persona.name.split(" ·")[0]}`}</button>
          </section>
        ))}
      </div>
      {status.data && !status.data.seeded ? <p className="mt-4 text-sm text-ink-light">Set up the demo first; then the buttons above become available.</p> : null}
    </div>
  );
}
