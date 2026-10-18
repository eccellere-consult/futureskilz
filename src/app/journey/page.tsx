"use client";

import { ArrowRight, CheckCircle2, Clock3, Route } from "lucide-react";
import Link from "next/link";

import { SiteHeader } from "@/components/site-header";
import { buildStarterJourney } from "@/features/journey/model";
import { useLearnerState } from "@/features/learner/use-learner-state";

export default function JourneyPage() {
  const { state, error } = useLearnerState();
  const snapshot = state?.snapshot;

  if (error) return <LoadError message={error} />;
  if (!snapshot) return <main className="min-h-screen bg-cream" aria-label="Building your journey" />;

  if (!snapshot.scores) {
    return (
      <main className="min-h-screen bg-cream text-ink">
        <SiteHeader step="Journey · 04" />
        <div className="mx-auto max-w-2xl px-5 py-24 text-center sm:px-8">
          <h1 className="font-serif text-5xl">Your journey needs a capability snapshot first.</h1>
          <Link className="primary-button mt-8" href="/assessment">Take the assessment <ArrowRight size={18} /></Link>
        </div>
      </main>
    );
  }

  const journey = buildStarterJourney(snapshot.scores, snapshot.completedSkillShots);

  return (
    <main className="min-h-screen bg-cream text-ink">
      <SiteHeader step="Journey · 04" />
      <div className="mx-auto w-full max-w-7xl px-5 py-12 sm:px-8 sm:py-18 lg:py-24">
        <div className="grid gap-10 border-t-2 border-gold bg-ink px-6 py-8 text-cream sm:p-10 lg:grid-cols-[1fr_22rem] lg:items-end">
          <div>
            <div className="flex items-center gap-3 text-gold-light"><Route size={20} /><span className="font-mono text-[11px] uppercase">Your first learning route</span></div>
            <h1 className="mt-5 max-w-4xl font-serif text-5xl leading-none font-light sm:text-6xl">Two focused moves, built around your gaps.</h1>
          </div>
          <div className="border-l-2 border-gold pl-5">
            <p className="font-mono text-[10px] uppercase text-gold-light">Goal</p>
            <p className="mt-2 text-sm leading-6 text-cream/65">{snapshot.draft.goal || "Build practical future-ready capability."}</p>
          </div>
        </div>

        <section className="mt-12" aria-labelledby="journey-steps">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-3xl" id="journey-steps">Starter journey</h2>
            <span className="font-mono text-[10px] uppercase text-ink-light">About {journey.reduce((total, step) => total + step.skillShot.durationMinutes, 0)} minutes</span>
          </div>
          <div className="mt-7 divide-y divide-border border-y border-border">
            {journey.map((step) => {
              const completed = snapshot.completedSkillShots?.includes(step.skillShot.slug) ?? false;
              return (
                <article className="grid gap-5 py-7 sm:grid-cols-[3rem_minmax(0,1fr)_auto] sm:items-center" key={step.skillShot.slug}>
                  <div className={`flex h-10 w-10 items-center justify-center border font-mono text-xs ${completed ? "border-teal bg-teal text-white" : "border-gold text-gold"}`}>
                    {completed ? <CheckCircle2 size={18} /> : `0${step.sequence}`}
                  </div>
                  <div>
                    <p className="font-mono text-[10px] uppercase text-teal">{completed ? "Completed" : step.status === "ready" ? "Ready now" : "Up next"} · {step.skillShot.pillarId.replaceAll("-", " ")}</p>
                    <h3 className="mt-2 font-serif text-2xl">{step.skillShot.title}</h3>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-light">{step.skillShot.objective}</p>
                  </div>
                  <div className="flex items-center justify-between gap-5 sm:justify-end">
                    <span className="flex items-center gap-2 text-xs text-ink-light"><Clock3 size={15} /> {step.skillShot.durationMinutes} min</span>
                    <Link className="primary-button" href={`/skill-shots/${step.skillShot.slug}`}>
                      {completed ? "Review" : "Open"}<ArrowRight size={17} />
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
function LoadError({ message }: { message: string }) {
  return (
    <main className="min-h-screen bg-cream text-ink">
      <SiteHeader step="Journey · 04" />
      <div className="mx-auto max-w-2xl px-5 py-24 text-center sm:px-8">
        <h1 className="font-serif text-4xl">We couldn’t open your journey.</h1>
        <p className="mt-4 text-sm text-ink-mid" role="alert">{message}</p>
      </div>
    </main>
  );
}
