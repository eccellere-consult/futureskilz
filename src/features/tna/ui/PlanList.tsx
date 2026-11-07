"use client";

import { ClipboardList } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { messageOf, post, shortDate, useRemote } from "@/features/capture/ui/api";
import type { ProgramSummary } from "@/server/tna/service";

import { proficiencies, type Proficiency } from "../types";

const LEVEL_LABEL: Record<Proficiency, string> = { foundational: "Beginners", working: "People who do this work already", advanced: "Experienced people" };
const STATUS_LABEL: Record<string, string> = { draft: "Draft", reviewing: "In review", approved: "Approved" };

const STEPS = ["The topic", "The learners", "The result", "Limits and facts"] as const;

/**
 * The start of every training: a list of the plans so far and a short click-through, one decision at a time. Nothing here
 * calls the AI; the next screen does, and everything it proposes waits for the person to confirm.
 */
export function PlanList() {
  const router = useRouter();
  const list = useRemote<{ programs: ProgramSummary[] }>("/api/contribute/tna");
  const [starting, setStarting] = useState(false);
  const [step, setStep] = useState(0);
  const [topic, setTopic] = useState("");
  const [role, setRole] = useState("");
  const [level, setLevel] = useState<Proficiency>("working");
  const [language, setLanguage] = useState("English");
  const [goal, setGoal] = useState("");
  const [minutes, setMinutes] = useState("");
  const [deadline, setDeadline] = useState("");
  const [notes, setNotes] = useState("");
  const [context, setContext] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = [topic.trim().length >= 4, role.trim().length >= 2, goal.trim().length >= 4, true][step];

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const minutesNumber = Number(minutes);
      const created = await post<{ id: string }>("/api/contribute/tna", {
        topic,
        audience: { role, level, language: language || "English" },
        goal,
        constraints: { ...(minutes && Number.isFinite(minutesNumber) ? { minutesPerLearner: Math.round(minutesNumber) } : {}), ...(deadline ? { deadline } : {}), ...(notes ? { notes } : {}) },
        context,
      });
      router.push(`/contribute/training-needs/${created.id}`);
    } catch (caught) {
      setError(messageOf(caught));
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-3xl">Plan a training</h1>
      <p className="mt-2 text-sm leading-6 text-ink-mid">Start with a big topic. I help you find what the learners cannot yet do, then break the topic into small pieces, each about the size of one Skill Shot. The AI only proposes: you confirm, change or reject every need and every topic.</p>

      {!starting ? (
        <p className="mt-6">
          <button className="primary-button" onClick={() => setStarting(true)} type="button">Start a new training plan</button>
        </p>
      ) : (
        <section aria-label="New training plan" className="mt-6 border border-border bg-surface p-4">
          <p className="font-mono text-[10px] uppercase text-ink-light">Step {step + 1} of {STEPS.length}: {STEPS[step]}</p>
          {step === 0 ? (
            <label className="mt-3 block text-sm">
              <span className="font-medium">What is the big topic?</span>
              <span className="mt-1 block text-xs text-ink-mid">Say it the way you would to a colleague. A whole subject is fine; we cut it down together.</span>
              <input className="field-input mt-1" maxLength={300} onChange={(event) => setTopic(event.target.value)} placeholder="For example: Supervisors leading shop-floor quality" value={topic} />
            </label>
          ) : null}
          {step === 1 ? (
            <div className="mt-3 grid gap-4 text-sm">
              <label className="block">
                <span className="font-medium">Who are the learners?</span>
                <input className="field-input mt-1" maxLength={160} onChange={(event) => setRole(event.target.value)} placeholder="For example: First-line supervisors in a machining plant" value={role} />
              </label>
              <fieldset>
                <legend className="font-medium">Where are they now?</legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {proficiencies.map((item) => (
                    <button aria-pressed={level === item} className={`min-h-10 border px-3 text-xs ${level === item ? "border-teal bg-teal/10" : "border-border"}`} key={item} onClick={() => setLevel(item)} type="button">{LEVEL_LABEL[item]}</button>
                  ))}
                </div>
              </fieldset>
              <label className="block">
                <span className="font-medium">Language of the training</span>
                <input className="field-input mt-1" maxLength={40} onChange={(event) => setLanguage(event.target.value)} value={language} />
              </label>
            </div>
          ) : null}
          {step === 2 ? (
            <label className="mt-3 block text-sm">
              <span className="font-medium">What should be different once they finish?</span>
              <span className="mt-1 block text-xs text-ink-mid">Something you could see at work, such as fewer rejected batches or faster handovers.</span>
              <textarea className="field-input mt-1 min-h-28" maxLength={600} onChange={(event) => setGoal(event.target.value)} value={goal} />
            </label>
          ) : null}
          {step === 3 ? (
            <div className="mt-3 grid gap-4 text-sm">
              <p className="text-xs text-ink-mid">All optional, but facts make the proposals better. What the client told you counts as a claim to check, not as proof.</p>
              <label className="block">
                <span className="font-medium">Minutes each learner can give in total</span>
                <input className="field-input mt-1" inputMode="numeric" onChange={(event) => setMinutes(event.target.value.replace(/\D/g, ""))} placeholder="For example: 240" value={minutes} />
              </label>
              <label className="block">
                <span className="font-medium">By when?</span>
                <input className="field-input mt-1" maxLength={80} onChange={(event) => setDeadline(event.target.value)} value={deadline} />
              </label>
              <label className="block">
                <span className="font-medium">Anything that limits the training</span>
                <input className="field-input mt-1" maxLength={600} onChange={(event) => setNotes(event.target.value)} placeholder="For example: only phones, shift work, mixed languages" value={notes} />
              </label>
              <label className="block">
                <span className="font-medium">What the client said or showed you</span>
                <textarea className="field-input mt-1 min-h-28" maxLength={4000} onChange={(event) => setContext(event.target.value)} placeholder="Complaints, numbers, observations, notes from a call" value={context} />
              </label>
            </div>
          ) : null}
          {error ? <p className="mt-3 text-sm text-crimson" role="alert">{error}</p> : null}
          <div className="mt-4 flex flex-wrap gap-2">
            {step > 0 ? <button className="min-h-12 border border-border px-4 text-sm" disabled={busy} onClick={() => setStep(step - 1)} type="button">Back</button> : null}
            {step < STEPS.length - 1 ? (
              <button className="primary-button" disabled={!ready} onClick={() => setStep(step + 1)} type="button">Next</button>
            ) : (
              <button className="primary-button" disabled={busy} onClick={() => void create()} type="button">{busy ? "Starting…" : "Start the plan"}</button>
            )}
          </div>
        </section>
      )}

      <section aria-label="Your training plans" className="mt-10">
        <h2 className="flex items-center gap-2 font-display text-xl"><ClipboardList aria-hidden="true" size={18} /> Your plans</h2>
        {list.error ? <p className="mt-3 text-sm text-crimson" role="alert">{list.error}</p> : null}
        {!list.data && !list.error ? <p className="mt-3 text-sm text-ink-mid">Loading…</p> : null}
        {list.data && !list.data.programs.length ? <p className="mt-3 text-sm text-ink-mid">No plans yet. Start one above.</p> : null}
        {list.data?.programs.length ? (
          <ul className="mt-3 grid gap-2">
            {list.data.programs.map((plan) => (
              <li className="border border-border bg-surface p-3" key={plan.id}>
                <Link className="font-medium underline" href={`/contribute/training-needs/${plan.id}`}>{plan.title}</Link>
                <p className="mt-1 text-xs text-ink-mid">{STATUS_LABEL[plan.status] ?? plan.status}{plan.working ? ", AI is working" : ""} · updated {shortDate(plan.updatedAt)}</p>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}
