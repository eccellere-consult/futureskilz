"use client";

import { ArrowRight, CheckCircle2, Clock3, Route } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { SiteHeader } from "@/components/site-header";
import { buildStarterJourney } from "@/features/journey/model";
import { loadLearnerSnapshot, type LearnerSnapshot } from "@/features/learner/draft";

export default function JourneyPage() {
  const [snapshot, setSnapshot] = useState<LearnerSnapshot | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setSnapshot(loadLearnerSnapshot()), 0);
    return () => window.clearTimeout(timer);
  }, []);

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
        <div className="grid gap-10 border-b border-border pb-12 lg:grid-cols-[1fr_22rem] lg:items-end">
          <div>
            <div className="flex items-center gap-3 text-gold"><Route size={20} /><span className="font-mono text-[11px] uppercase">Your first learning route</span></div>
            <h1 className="mt-5 max-w-4xl font-serif text-5xl leading-none font-light sm:text-6xl">Two focused moves, built around your gaps.</h1>
          </div>
          <div className="border-l-2 border-gold pl-5">
            <p className="font-mono text-[10px] uppercase text-ink-light">Goal</p>
            <p className="mt-2 text-sm leading-6 text-ink-mid">{snapshot.draft.goal || "Build practical future-ready capability."}</p>
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