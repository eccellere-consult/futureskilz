"use client";

import { ClipboardList, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { messageOf, post, shortDate, useRemote } from "@/features/capture/ui/api";
import type { ProgramSummary } from "@/server/tna/service";

import { mergeSuggestions, type AssistField, type AssistQuestion, type AssistResult } from "../assist";
import { proficiencies, type Proficiency } from "../types";

const LEVEL_LABEL: Record<Proficiency, string> = { foundational: "Beginners", working: "People who do this work already", advanced: "Experienced people" };
const STATUS_LABEL: Record<string, string> = { draft: "Draft", reviewing: "In review", approved: "Approved" };

const STEPS = ["The topic", "The learners", "The result", "Limits and facts"] as const;
const MAX_ROUNDS = 5;

const Badge = ({ show }: { show: boolean }) => (show ? <span className="ml-2 border border-gold/60 px-1.5 py-0.5 font-mono text-[10px] uppercase text-ink-mid">AI suggestion: check it</span> : null);

/**
 * The start of every training: a list of the plans so far and a short click-through, one decision at a time. Once the topic is
 * typed, the AI can suggest the empty boxes and ask the few questions that would change them. It never overwrites what the person
 * typed, and every suggestion is marked until they edit it. Creating the plan itself calls no AI; the next screen does.
 */
export function PlanList() {
  const router = useRouter();
  const list = useRemote<{ programs: ProgramSummary[] }>("/api/contribute/tna");
  const [starting, setStarting] = useState(false);
  const [step, setStep] = useState(0);
  const [topic, setTopic] = useState("");
  const [role, setRole] = useState("");
  const [level, setLevel] = useState<Proficiency | null>(null);
  const [language, setLanguage] = useState("English");
  const [goal, setGoal] = useState("");
  const [minutes, setMinutes] = useState("");
  const [deadline, setDeadline] = useState("");
  const [notes, setNotes] = useState("");
  const [context, setContext] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [aiFilled, setAiFilled] = useState<Set<AssistField>>(new Set());
  const [questions, setQuestions] = useState<AssistQuestion[]>([]);
  const [answers, setAnswers] = useState<Array<{ question: string; answer: string }>>([]);
  const [rounds, setRounds] = useState(0);
  const [assisting, setAssisting] = useState(false);
  const [assistNote, setAssistNote] = useState<string | null>(null);
  const [typed, setTyped] = useState("");

  const ready = [topic.trim().length >= 4, role.trim().length >= 2, goal.trim().length >= 4, true][step];
  const minutesNumber = Number(minutes);

  /** A person's own edit: the field no longer holds an AI suggestion. */
  const own = (field: AssistField, apply: () => void) => {
    apply();
    setAiFilled((current) => {
      if (!current.has(field)) return current;
      const next = new Set(current);
      next.delete(field);
      return next;
    });
  };

  async function assist(withAnswers = answers) {
    if (topic.trim().length < 4 || rounds >= MAX_ROUNDS) return;
    setAssisting(true);
    setError(null);
    try {
      // Only what the person typed goes in as "known"; the AI may refine its own earlier suggestions.
      const result = await post<AssistResult>("/api/contribute/tna/assist", {
        topic,
        ...(role && !aiFilled.has("role") ? { role } : {}),
        ...(level && !aiFilled.has("level") ? { level } : {}),
        language: language || "English",
        ...(goal && !aiFilled.has("goal") ? { goal } : {}),
        ...(minutes && !aiFilled.has("minutesPerLearner") && Number.isFinite(minutesNumber) && minutesNumber >= 10 ? { minutesPerLearner: Math.round(minutesNumber) } : {}),
        ...(notes && !aiFilled.has("notes") ? { notes } : {}),
        ...(context ? { context } : {}),
        answers: withAnswers,
      });
      const merged = mergeSuggestions({ role, level: level ?? undefined, goal, minutesPerLearner: minutes ? minutesNumber : undefined, notes } as Record<AssistField, string | number | undefined>, aiFilled, result.suggestions);
      setRole(String(merged.values.role ?? ""));
      setLevel((merged.values.level as Proficiency | undefined) ?? null);
      setGoal(String(merged.values.goal ?? ""));
      setMinutes(merged.values.minutesPerLearner ? String(merged.values.minutesPerLearner) : "");
      setNotes(String(merged.values.notes ?? ""));
      setAiFilled(merged.aiFilled);
      setQuestions(result.questions);
      setAssistNote(result.notes[0] ?? null);
      setRounds((value) => value + 1);
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setAssisting(false);
    }
  }

  async function answer(question: string, text: string) {
    const clean = text.trim();
    if (!clean) return;
    const next = [...answers, { question, answer: clean }];
    setAnswers(next);
    setQuestions((current) => current.filter((item) => item.question !== question));
    setTyped("");
    await assist(next);
  }

  function next() {
    // Moving on from the topic is the first moment there is enough to ask the AI for help.
    if (step === 0 && rounds === 0 && !assisting) void assist();
    setStep(step + 1);
  }

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const created = await post<{ id: string }>("/api/contribute/tna", {
        topic,
        audience: { role, level: level ?? "working", language: language || "English" },
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

  const question = questions[0];

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
                <span className="font-medium">Who are the learners?</span><Badge show={aiFilled.has("role")} />
                <input className="field-input mt-1" maxLength={160} onChange={(event) => own("role", () => setRole(event.target.value))} placeholder="For example: First-line supervisors in a machining plant" value={role} />
              </label>
              <fieldset>
                <legend className="font-medium">Where are they now?<Badge show={aiFilled.has("level")} /></legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {proficiencies.map((item) => (
                    <button aria-pressed={level === item} className={`min-h-10 border px-3 text-xs ${level === item ? "border-teal bg-teal/10" : "border-border"}`} key={item} onClick={() => own("level", () => setLevel(item))} type="button">{LEVEL_LABEL[item]}</button>
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
              <span className="font-medium">What should be different once they finish?</span><Badge show={aiFilled.has("goal")} />
              <span className="mt-1 block text-xs text-ink-mid">Something you could see at work, such as fewer rejected batches or faster handovers.</span>
              <textarea className="field-input mt-1 min-h-28" maxLength={600} onChange={(event) => own("goal", () => setGoal(event.target.value))} value={goal} />
            </label>
          ) : null}
          {step === 3 ? (
            <div className="mt-3 grid gap-4 text-sm">
              <p className="text-xs text-ink-mid">All optional, but facts make the proposals better. What the client told you counts as a claim to check, not as proof.</p>
              <label className="block">
                <span className="font-medium">Minutes each learner can give in total</span><Badge show={aiFilled.has("minutesPerLearner")} />
                <input className="field-input mt-1" inputMode="numeric" onChange={(event) => own("minutesPerLearner", () => setMinutes(event.target.value.replace(/\D/g, "")))} placeholder="For example: 240" value={minutes} />
              </label>
              <label className="block">
                <span className="font-medium">By when?</span>
                <input className="field-input mt-1" maxLength={80} onChange={(event) => setDeadline(event.target.value)} value={deadline} />
              </label>
              <label className="block">
                <span className="font-medium">Anything that limits the training</span><Badge show={aiFilled.has("notes")} />
                <input className="field-input mt-1" maxLength={600} onChange={(event) => own("notes", () => setNotes(event.target.value))} placeholder="For example: only phones, shift work, mixed languages" value={notes} />
              </label>
              <label className="block">
                <span className="font-medium">What the client said or showed you</span>
                <span className="mt-1 block text-xs text-ink-mid">This one is yours: I never fill it in, because I must not invent facts about the client.</span>
                <textarea className="field-input mt-1 min-h-28" maxLength={4000} onChange={(event) => setContext(event.target.value)} placeholder="Complaints, numbers, observations, notes from a call" value={context} />
              </label>
            </div>
          ) : null}

          {step > 0 ? (
            <div aria-label="AI help" className="mt-4 border-l-2 border-gold bg-cream/60 p-3 text-sm">
              {question ? (
                <div>
                  <p className="font-medium">{question.question}</p>
                  {question.why ? <p className="mt-1 text-xs text-ink-mid">{question.why}</p> : null}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {question.options.map((option) => (
                      <button className="min-h-10 border border-border px-3 text-xs" disabled={assisting} key={option} onClick={() => void answer(question.question, option)} type="button">{option}</button>
                    ))}
                  </div>
                  <div className="mt-2 flex gap-2">
                    <input aria-label="Or answer in your own words" className="field-input min-w-0 flex-1 py-1.5! text-xs" maxLength={400} onChange={(event) => setTyped(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void answer(question.question, typed); }} placeholder="Or answer in your own words" value={typed} />
                    <button className="min-h-10 border border-border px-3 text-xs" disabled={assisting || !typed.trim()} onClick={() => void answer(question.question, typed)} type="button">Use this</button>
                  </div>
                </div>
              ) : null}
              <div className={question ? "mt-3" : ""}>
                <button className="min-h-10 border border-border px-3 text-xs" disabled={assisting || rounds >= MAX_ROUNDS} onClick={() => void assist()} type="button"><Sparkles aria-hidden="true" className="mr-1 inline" size={14} />{assisting ? "Thinking…" : rounds ? "Suggest again with AI" : "Suggest the empty boxes with AI"}</button>
                {assistNote ? <p className="mt-2 text-xs text-ink-mid">{assistNote}</p> : null}
                {aiFilled.size ? <p className="mt-2 text-xs text-ink-mid">Boxes marked &quot;AI suggestion&quot; are guesses. Change any of them; what you type is never overwritten.</p> : null}
              </div>
            </div>
          ) : null}

          {error ? <p className="mt-3 text-sm text-crimson" role="alert">{error}</p> : null}
          <div className="mt-4 flex flex-wrap gap-2">
            {step > 0 ? <button className="min-h-12 border border-border px-4 text-sm" disabled={busy} onClick={() => setStep(step - 1)} type="button">Back</button> : null}
            {step < STEPS.length - 1 ? (
              <button className="primary-button" disabled={!ready} onClick={next} type="button">Next</button>
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
