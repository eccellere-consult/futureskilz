"use client";

import { ArrowRight, Undo2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { AryaPanel, useDayPart } from "@/features/arya/AryaPanel";
import { diagnosticClose, diagnosticWelcome } from "@/features/arya/scripts";
import type { LearnerSnapshot } from "@/features/learner/draft";
import { estimateSkills } from "@/features/pathway/estimate";
import { getRole } from "@/features/pathway/roles";
import { loadTargetRoleId } from "@/features/pathway/store";

import { nextPrompt, type DiagnosticAnswer } from "./engine";
import { NO_SITUATION, OUTCOME_OPTIONS } from "./questions";
import { loadDiagnosticAnswers, saveDiagnosticAnswers } from "./store";
import { summarise } from "./summary";

/**
 * One decision at a time, in Arya's company. The learner clicks what they actually did in a recent situation; the engine picks the
 * next question from the answers so far, and the conversation ends with what was heard, what it may mean, what is uncertain and
 * what happens next. Every answer is saved as it is given, so leaving and coming back resumes.
 */
export function DiagnosticConversation({ snapshot }: { snapshot: LearnerSnapshot }) {
  const part = useDayPart();
  const [answers, setAnswers] = useState<DiagnosticAnswer[]>([]);
  const [roleId, setRoleId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [started, setStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.all([loadDiagnosticAnswers(), loadTargetRoleId()]).then(([saved, role]) => {
      if (!active) return;
      setAnswers(saved.answers);
      setStarted(saved.answers.length > 0);
      setRoleId(role);
      setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, []);

  const role = roleId ? getRole(roleId) : undefined;
  const baseline = useMemo(() => estimateSkills(snapshot.scores), [snapshot.scores]);
  const prompt = useMemo(() => nextPrompt(answers, { role, baseline }), [answers, role, baseline]);

  const commit = async (next: DiagnosticAnswer[]) => {
    setAnswers(next);
    setError(null);
    const done = nextPrompt(next, { role, baseline }).kind === "done";
    try {
      await saveDiagnosticAnswers(next, done);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Your answers could not be saved.");
    }
  };

  const choose = (option: number | null) => {
    if (prompt.kind !== "core") return;
    void commit([...answers, { questionId: prompt.question.id, option }]);
  };
  const chooseOutcome = (outcome: number) => {
    if (prompt.kind !== "outcome") return;
    void commit(answers.map((answer) => (answer.questionId === prompt.question.id ? { ...answer, outcome } : answer)));
  };
  const undo = () => {
    // Take back the last step: its result if it has one, otherwise the answer itself.
    const last = answers.at(-1);
    if (!last) return;
    void commit(last.outcome !== undefined ? [...answers.slice(0, -1), { questionId: last.questionId, option: last.option }] : answers.slice(0, -1));
  };

  if (!loaded) return <div className="min-h-96" aria-label="Loading" />;

  const script = !started ? diagnosticWelcome(part, snapshot.draft.name) : prompt.kind === "done" ? diagnosticClose() : prompt.kind === "outcome" ? `You said: ${prompt.chosen} What came of it?` : prompt.question.prompt;

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-10 px-5 py-12 sm:px-8 sm:py-18 lg:grid-cols-[22rem_minmax(0,1fr)] lg:gap-16 lg:py-20">
      <aside className="border-t-2 border-gold bg-ink p-6 text-cream sm:p-8 lg:self-start">
        <p className="font-mono text-[11px] uppercase text-gold-light">A closer look</p>
        <h1 className="mt-3 font-serif text-4xl leading-none font-light sm:text-5xl">Recent situations, not ratings.</h1>
        <AryaPanel autoKey={started ? answers.length : "welcome"} className="mt-6" quiet script={script} stageClassName="h-56" />
        <p className="mt-5 text-xs leading-5 text-cream/55">{role ? `Shaped around ${role.title}. ` : "No target role chosen, so I will cover every area. "}Arya is an AI. Your answers are your own description, not a test.</p>
      </aside>

      <section aria-live="polite" className="border-t-2 border-gold bg-surface px-5 py-8 shadow-[0_18px_48px_rgba(14,14,13,0.08)] sm:px-10 sm:py-10">
        {error ? <p className="mb-4 text-sm text-crimson" role="alert">{error}</p> : null}

        {!started ? (
          <div>
            <h2 className="font-serif text-3xl leading-tight sm:text-4xl">Before we start</h2>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-ink-mid">{script}</p>
            <button className="primary-button mt-8" onClick={() => setStarted(true)} type="button">Begin<ArrowRight size={18} /></button>
          </div>
        ) : prompt.kind === "done" ? (
          <Closing answers={answers} roleId={roleId} />
        ) : (
          <div>
            <div className="flex items-center justify-between font-mono text-[10px] uppercase text-ink-light">
              <span>{prompt.kind === "outcome" ? "What came of it" : "A recent situation"}</span>
              <span>About {Math.max(1, prompt.progress.estimatedTotal - prompt.progress.answered)} left</span>
            </div>
            <h2 className="mt-6 max-w-3xl font-serif text-3xl leading-tight sm:text-4xl">{prompt.kind === "outcome" ? `You said: “${prompt.chosen}” What came of it?` : prompt.question.prompt}</h2>
            {prompt.kind === "core" ? <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-light"><span className="font-semibold">Why I ask:</span> {prompt.question.why}</p> : <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-light"><span className="font-semibold">Why I ask:</span> A result is firmer evidence than a description of what someone did, so it makes your estimate more reliable.</p>}

            <div className="mt-8 grid gap-3">
              {prompt.kind === "core"
                ? prompt.question.options.map((option, index) => (
                    <button className="min-h-16 border border-border bg-cream px-4 py-3 text-left transition-colors hover:border-gold sm:px-5" key={option.text} onClick={() => choose(index)} type="button">{option.text}</button>
                  ))
                : OUTCOME_OPTIONS.map((option, index) => (
                    <button className="min-h-16 border border-border bg-cream px-4 py-3 text-left transition-colors hover:border-gold sm:px-5" key={option.text} onClick={() => chooseOutcome(index)} type="button">{option.text}</button>
                  ))}
              {prompt.kind === "core" ? <button className="min-h-14 border border-dashed border-border px-4 py-3 text-left text-ink-mid transition-colors hover:border-gold sm:px-5" onClick={() => choose(null)} type="button">{NO_SITUATION}</button> : null}
            </div>
            {answers.length > 0 ? <button className="mt-6 inline-flex items-center gap-2 text-sm text-ink-mid underline underline-offset-4" onClick={undo} type="button"><Undo2 aria-hidden="true" size={15} />Change my last answer</button> : null}
          </div>
        )}
      </section>
    </div>
  );
}

function Closing({ answers, roleId }: { answers: DiagnosticAnswer[]; roleId: string | null }) {
  const summary = summarise(answers, roleId ? getRole(roleId) : undefined);
  const block = (title: string, lines: string[]) => (
    <div className="border-t border-border pt-5">
      <h3 className="font-mono text-[10px] uppercase text-teal">{title}</h3>
      <ul className="mt-2 space-y-2 text-ink-mid">{lines.map((line) => <li className="leading-7" key={line}>{line}</li>)}</ul>
    </div>
  );
  return (
    <div>
      <h2 className="font-serif text-3xl leading-tight sm:text-4xl">Here is what I heard.</h2>
      <div className="mt-6 grid gap-6">
        {block("What I heard", summary.heard)}
        {block("What it may mean", summary.mayMean)}
        {block("What is still uncertain", summary.uncertain)}
      </div>
      <div className="mt-8 border-l-2 border-gold pl-4">
        <p className="font-mono text-[10px] uppercase text-teal">What happens next</p>
        <p className="mt-1 text-ink-mid">Your gap table now uses these answers where they are firmer than your first self-rating.</p>
        <Link className="primary-button mt-4" href={summary.next.href}>{summary.next.label}<ArrowRight size={18} /></Link>
      </div>
    </div>
  );
}
