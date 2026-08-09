"use client";

import { ArrowLeft, ArrowRight, CheckCircle2, Clock3 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { applyEvidence, type SkillShot } from "./model";
import { loadLearnerSnapshot, saveLearnerSnapshot } from "../learner/draft";

export function SkillShotExperience({ skillShot }: { skillShot: SkillShot }) {
  const [practice, setPractice] = useState("");
  const [answer, setAnswer] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [evidenceAdded, setEvidenceAdded] = useState(false);
  const correct = answer === skillShot.checkIn.correctIndex;

  function checkAnswer() {
    if (answer === null) return;
    setSubmitted(true);

    if (!correct) return;

    const snapshot = loadLearnerSnapshot();
    if (!snapshot.scores || snapshot.completedSkillShots?.includes(skillShot.slug)) {
      setEvidenceAdded(false);
      return;
    }

    saveLearnerSnapshot({
      ...snapshot,
      scores: applyEvidence(snapshot.scores, skillShot.pillarId),
      completedSkillShots: [...(snapshot.completedSkillShots ?? []), skillShot.slug],
      evidence: [
        ...(snapshot.evidence ?? []),
        {
          skillShotSlug: skillShot.slug,
          pillarId: skillShot.pillarId,
          scoreDelta: 10,
          createdAt: new Date().toISOString(),
        },
      ],
    });
    setEvidenceAdded(true);
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8 sm:py-16">
      <Link className="inline-flex items-center gap-2 text-sm text-ink-light hover:text-teal" href="/journey"><ArrowLeft size={17} /> Back to journey</Link>
      <div className="mt-8 grid gap-12 lg:grid-cols-[minmax(0,1fr)_16rem] lg:gap-20">
        <article>
          <p className="font-mono text-[10px] uppercase text-gold">Skill Shot · {skillShot.pillarId.replaceAll("-", " ")}</p>
          <h1 className="mt-4 max-w-3xl font-serif text-5xl leading-none sm:text-6xl">{skillShot.title}</h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-ink-mid">{skillShot.objective}</p>

          <div className="mt-10 space-y-10 border-t border-border pt-10">
            <LearningBlock label="Why it matters" text={skillShot.whyItMatters} />
            <LearningBlock label="The technique" text={skillShot.concept} />
            <LearningBlock label="In practice" text={skillShot.example} />
          </div>

          <section className="mt-12 border-t-2 border-gold bg-surface p-5 shadow-[0_18px_48px_rgba(14,14,13,0.08)] sm:p-8" aria-labelledby="practice-heading">
            <p className="font-mono text-[10px] uppercase text-gold">Try it now</p>
            <h2 className="mt-3 font-serif text-3xl" id="practice-heading">Apply the technique to your work.</h2>
            <p className="mt-3 text-sm leading-6 text-ink-mid">{skillShot.practicePrompt}</p>
            <textarea className="field-input mt-5 min-h-28 resize-none" onChange={(event) => setPractice(event.target.value)} placeholder="Write a short working note..." value={practice} />
          </section>

          <section className="mt-10 border border-border p-5 sm:p-8" aria-labelledby="check-in-heading">
            <p className="font-mono text-[10px] uppercase text-teal">One-question check-in</p>
            <h2 className="mt-3 font-serif text-3xl" id="check-in-heading">{skillShot.checkIn.question}</h2>
            <div className="mt-6 grid gap-3">
              {skillShot.checkIn.options.map((option, index) => (
                <button
                  aria-pressed={answer === index}
                  className={`border px-4 py-3 text-left text-sm leading-6 ${answer === index ? "border-teal bg-teal text-white" : "border-border bg-cream hover:border-gold"}`}
                  key={option}
                  onClick={() => { setAnswer(index); setSubmitted(false); }}
                  type="button"
                >
                  {option}
                </button>
              ))}
            </div>
            {submitted ? (
              <p className={`mt-5 text-sm ${correct ? "text-teal" : "text-crimson"}`} role="status">
                {correct
                  ? evidenceAdded
                    ? "Correct. Evidence captured and your pillar score moved by 10 points."
                    : "Correct. This Skill Shot is already recorded in your evidence."
                  : "Not quite. Revisit the technique and try once more."}
              </p>
            ) : null}
            <div className="mt-6 flex justify-end">
              {submitted && correct ? (
                <Link className="primary-button" href="/profile">See updated profile <ArrowRight size={17} /></Link>
              ) : (
                <button className="primary-button" disabled={answer === null || practice.trim().length < 8} onClick={checkAnswer} type="button">Check my answer <ArrowRight size={17} /></button>
              )}
            </div>
          </section>
        </article>

        <aside className="h-fit border-t-2 border-gold bg-purple p-6 text-cream lg:sticky lg:top-8">
          <Clock3 className="text-gold-light" size={21} />
          <p className="mt-4 font-mono text-[10px] uppercase text-gold-light">Time to complete</p>
          <p className="mt-2 font-serif text-3xl">{skillShot.durationMinutes} minutes</p>
          <div className="mt-6 border-t border-cream/15 pt-6">
            <CheckCircle2 className="text-teal" size={20} />
            <p className="mt-3 text-xs leading-5 text-cream/65">Practice and the check-in create visible evidence in your capability profile.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function LearningBlock({ label, text }: { label: string; text: string }) {
  return <section><p className="font-mono text-[10px] uppercase text-ink-light">{label}</p><p className="mt-3 max-w-3xl text-base leading-8 text-ink-mid">{text}</p></section>;
}