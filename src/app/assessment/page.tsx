"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { SiteHeader } from "@/components/site-header";
import {
  pillars,
  scoreAssessment,
  type AssessmentAnswers,
} from "@/features/assessment/model";
import { loadLearnerSnapshot, saveLearnerSnapshot } from "@/features/learner/draft";

export default function AssessmentPage() {
  const router = useRouter();
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<AssessmentAnswers>({});
  const pillar = pillars[questionIndex];
  const selectedAnswer = answers[pillar.id];

  function chooseAnswer(answer: number) {
    setAnswers((current) => ({ ...current, [pillar.id]: answer }));
  }

  function continueAssessment() {
    if (selectedAnswer === undefined) return;

    if (questionIndex < pillars.length - 1) {
      setQuestionIndex((current) => current + 1);
      return;
    }

    const scores = scoreAssessment(answers);
    const snapshot = loadLearnerSnapshot();
    saveLearnerSnapshot({ ...snapshot, answers, scores });
    router.push("/profile");
  }

  return (
    <main className="min-h-screen bg-cream text-ink">
      <SiteHeader step="Assess · 02" />
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-5 py-12 sm:px-8 sm:py-18 lg:grid-cols-[18rem_minmax(0,1fr)] lg:gap-20 lg:py-24">
        <aside>
          <p className="font-mono text-[11px] uppercase text-gold">Capability snapshot</p>
          <h1 className="mt-4 font-serif text-4xl leading-none font-light sm:text-5xl">How you work, not what you know.</h1>
          <p className="mt-5 text-sm leading-6 text-ink-mid">
            Choose the response that sounds most like you today. There are no perfect answers.
          </p>
          <ol className="mt-8 hidden space-y-3 lg:block">
            {pillars.map((item, index) => (
              <li className={`flex items-center gap-3 text-sm ${index === questionIndex ? "font-semibold text-teal" : index < questionIndex ? "text-ink" : "text-ink-light"}`} key={item.id}>
                <span className={`h-2 w-2 ${index <= questionIndex ? "bg-gold" : "bg-border"}`} />
                {item.shortName}
              </li>
            ))}
          </ol>
        </aside>

        <section aria-labelledby="assessment-question" className="border-t-2 border-gold bg-surface px-5 py-8 shadow-[0_18px_48px_rgba(14,14,13,0.08)] sm:px-10 sm:py-10">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase text-ink-light">{pillar.name}</span>
            <span className="font-mono text-[10px] text-ink-light">{questionIndex + 1} / {pillars.length}</span>
          </div>
          <h2 className="mt-8 max-w-3xl font-serif text-3xl leading-tight sm:text-4xl" id="assessment-question">{pillar.question}</h2>

          <div className="mt-8 grid gap-3">
            {pillar.options.map((option, index) => {
              const selected = selectedAnswer === index;
              return (
                <button
                  aria-pressed={selected}
                  className={`grid min-h-16 grid-cols-[2.5rem_1fr] items-center border px-4 py-3 text-left transition-colors sm:px-5 ${selected ? "border-teal bg-teal text-white" : "border-border bg-cream text-ink hover:border-gold"}`}
                  key={option}
                  onClick={() => chooseAnswer(index)}
                  type="button"
                >
                  <span className={`font-mono text-xs ${selected ? "text-gold-light" : "text-ink-light"}`}>{String.fromCharCode(65 + index)}</span>
                  <span className="text-sm leading-6">{option}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-10 flex items-center justify-between border-t border-border pt-6">
            <button
              aria-label="Previous question"
              className="icon-button"
              disabled={questionIndex === 0}
              onClick={() => setQuestionIndex((current) => Math.max(0, current - 1))}
              title="Previous question"
              type="button"
            >
              <ArrowLeft aria-hidden="true" size={19} />
            </button>
            <button className="primary-button" disabled={selectedAnswer === undefined} onClick={continueAssessment} type="button">
              {questionIndex === pillars.length - 1 ? "See my snapshot" : "Next question"}
              <ArrowRight aria-hidden="true" size={18} />
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}