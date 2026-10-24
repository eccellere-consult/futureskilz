"use client";

import { ArrowRight, CloudCheck, RotateCcw, Sparkles } from "lucide-react";
import Link from "next/link";

import { SiteHeader } from "@/components/site-header";
import { skillTaxonomy } from "@/domain/skills/taxonomy";
import { findPriorityPillars } from "@/features/assessment/model";
import { buildStarterJourney } from "@/features/journey/model";
import { SignInForm } from "@/features/learner/sign-in-form";
import { useLearnerState } from "@/features/learner/use-learner-state";

export default function ProfilePage() {
  const { state, error } = useLearnerState();
  const snapshot = state?.snapshot;
  const signedIn = Boolean(state?.user);

  if (error) {
    return (
      <main className="min-h-screen bg-cream text-ink">
        <SiteHeader step="Profile · 03" />
        <div className="mx-auto max-w-2xl px-5 py-24 text-center sm:px-8">
          <h1 className="font-serif text-4xl">We couldn’t open your profile.</h1>
          <p className="mt-4 text-sm text-ink-mid" role="alert">{error}</p>
        </div>
      </main>
    );
  }

  if (!snapshot) {
    return <main className="min-h-screen bg-cream" aria-label="Building your capability snapshot" />;
  }

  if (!snapshot.scores) {
    return (
      <main className="min-h-screen bg-cream text-ink">
        <SiteHeader step="Profile · 03" />
        <div className="mx-auto max-w-2xl px-5 py-24 text-center sm:px-8">
          <h1 className="font-serif text-5xl">Your snapshot starts with a short conversation.</h1>
          <Link className="primary-button mt-8" href="/">Start discovery <ArrowRight size={18} /></Link>
        </div>
      </main>
    );
  }

  const priorities = findPriorityPillars(snapshot.scores);
  const nextSkillShot = buildStarterJourney(snapshot.scores, snapshot.completedSkillShots).find(
    ({ skillShot }) => !snapshot.completedSkillShots?.includes(skillShot.slug),
  )?.skillShot;
  const summary = snapshot.account?.welcomeSummary;

  return (
    <main className="min-h-screen bg-cream text-ink">
      <SiteHeader step="Profile · 03" />
      <div className="mx-auto w-full max-w-7xl px-5 py-12 sm:px-8 sm:py-18 lg:py-24">
        <div className="grid items-end gap-8 border-b border-border pb-10 lg:grid-cols-[1fr_auto]">
          <div>
            <p className="font-mono text-[11px] uppercase text-gold">Your capability snapshot</p>
            <h1 className="mt-4 max-w-4xl font-serif text-5xl leading-none font-light sm:text-6xl">
              {snapshot.draft.name ? `${snapshot.draft.name}, here’s` : "Here’s"} where to build next.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-ink-mid">
              This is a directional baseline, not a verdict. Evidence from practice will make it sharper over time.
            </p>
          </div>
          <Link className="icon-button" href="/" title={signedIn ? "Update my answers" : "Start a new snapshot"} aria-label={signedIn ? "Update my answers" : "Start a new snapshot"}>
            <RotateCcw aria-hidden="true" size={18} />
          </Link>
        </div>

        {signedIn ? (
          <section aria-label="Saved to your account" className="mt-8 grid gap-4 border-l-2 border-teal bg-surface px-5 py-4 sm:grid-cols-[auto_1fr] sm:items-start">
            <CloudCheck aria-hidden="true" className="text-teal" size={22} />
            <div>
              <p className="text-sm font-semibold">Saved to your account</p>
              {summary ? (
                <>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-mid">{summary}</p>
                  <p className="mt-2 font-mono text-[10px] uppercase text-ink-light">
                    Arya’s summary · {snapshot.account?.welcomeSummarySource === "ai" ? "AI-written from your answers" : "Written from your answers by a fixed template"}
                  </p>
                </>
              ) : (
                <p className="mt-1 text-xs leading-5 text-ink-light">Your profile, journey and evidence follow you to any device.</p>
              )}
            </div>
          </section>
        ) : (
          <section aria-labelledby="keep-heading" className="mt-8 grid gap-6 border-t-2 border-gold bg-surface p-5 shadow-[0_18px_48px_rgba(14,14,13,0.06)] sm:p-8 lg:grid-cols-[1fr_minmax(0,24rem)] lg:gap-12">
            <div>
              <p className="font-mono text-[10px] uppercase text-gold">Keep this profile</p>
              <h2 className="mt-3 font-serif text-3xl leading-tight" id="keep-heading">Save it, and pick up on any device.</h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-ink-mid">
                Right now this profile lives only in this browser. Add your email and we’ll keep it safe{nextSkillShot ? <>, then take you straight to <span className="font-medium text-ink">{nextSkillShot.title}</span></> : null}.
              </p>
            </div>
            <SignInForm
              includeGuestProgress
              name={snapshot.draft.name}
              next={nextSkillShot ? `/skill-shots/${nextSkillShot.slug}` : "/profile"}
              submitLabel="Save my profile"
            />
          </section>
        )}

        <div className="mt-12 grid gap-14 lg:grid-cols-[minmax(0,1.25fr)_minmax(20rem,0.75fr)] lg:gap-20">
          <section aria-labelledby="pillar-heading">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-3xl" id="pillar-heading">Five-pillar profile</h2>
              <span className="font-mono text-[10px] uppercase text-ink-light">{snapshot.evidence?.length ? "Self-reported baseline + check-in evidence" : "Baseline · Self-reported"}</span>
            </div>
            <div className="mt-8 space-y-7">
              {snapshot.scores.map((pillar) => (
                <div key={pillar.id}>
                  <div className="mb-2 flex items-end justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold">{pillar.name}</p>
                      <p className="mt-1 text-xs text-ink-light">{pillar.level}</p>
                    </div>
                    <span className="font-mono text-sm text-teal">{pillar.score}</span>
                  </div>
                  <div className="h-2 w-full bg-border" role="progressbar" aria-label={`${pillar.name}: ${pillar.score} out of 100`} aria-valuemax={100} aria-valuemin={0} aria-valuenow={pillar.score}>
                    <div className="h-full bg-teal" style={{ width: `${pillar.score}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <aside className="border-t-2 border-gold bg-ink p-6 text-cream sm:p-8">
            <Sparkles aria-hidden="true" className="text-gold-light" size={24} />
            <p className="mt-6 font-mono text-[10px] uppercase text-gold-light">Your priority gaps</p>
            <h2 className="mt-3 font-serif text-3xl leading-tight">Start where progress will compound.</h2>
            <div className="mt-7 divide-y divide-cream/15 border-y border-cream/15">
              {priorities.map((pillar, index) => (
                <div className="grid grid-cols-[2rem_1fr] gap-3 py-4" key={pillar.id}>
                  <span className="font-mono text-xs text-gold-light">0{index + 1}</span>
                  <div>
                    <p className="text-sm font-semibold">{pillar.name}</p>
                    <p className="mt-1 text-xs leading-5 text-cream/65">A focused Skill Shot and practice loop will target this pillar first.</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-7">
              <p className="text-xs leading-5 text-cream/65">Next up</p>
              <p className="mt-1 text-sm">Your first two Skill Shots are ready.</p>
              <Link className="primary-button mt-5" href="/journey">Open my journey <ArrowRight size={17} /></Link>
              <p className="mt-5 text-xs leading-5 text-cream/65">
                Want to practise on a real problem from your work?{" "}
                <Link className="font-semibold text-gold-light underline-offset-4 hover:underline" href="/problem-solving">Try the Problem Solving methods</Link>
              </p>
            </div>
          </aside>
        </div>

        {snapshot.evidence?.length ? (
          <section className="mt-16 border-t border-border pt-10" aria-labelledby="evidence-heading">
            <p className="font-mono text-[10px] uppercase text-teal">Visible progress</p>
            <h2 className="mt-3 font-serif text-3xl" id="evidence-heading">Evidence earned</h2>
            <div className="mt-6 divide-y divide-border border-y border-border">
              {snapshot.evidence.map((evidence) => (
                <div className="grid gap-2 py-4 sm:grid-cols-[1fr_auto]" key={`${evidence.skillShotSlug}-${evidence.createdAt}`}>
                  <p className="text-sm font-medium">Completed {evidence.skillShotSlug.replaceAll("-", " ")}</p>
                  <p className="font-mono text-xs text-teal">+{evidence.scoreDelta} · {evidence.pillarId.replaceAll("-", " ")} · check-in evidence</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {snapshot.draft.prioritySkills.length ? (
          <section className="mt-16 border-t border-border pt-10" aria-labelledby="direction-heading">
            <div className="grid gap-8 lg:grid-cols-[16rem_1fr]">
              <div>
                <p className="font-mono text-[10px] uppercase text-gold">Discovery direction</p>
                <h2 className="mt-3 font-serif text-3xl" id="direction-heading">What you asked us to explore.</h2>
                <p className="mt-3 text-xs leading-5 text-ink-light">Self-reported priorities guide the diagnosis; they do not prove proficiency.</p>
              </div>
              <div className="border-y border-border py-2">
                {skillTaxonomy.filter(({ slug }) => snapshot.draft.prioritySkills.includes(slug)).map((skill) => (
                  <div className="grid gap-2 border-b border-border py-4 last:border-b-0 sm:grid-cols-[1fr_auto]" key={skill.slug}>
                    <div>
                      <p className="text-sm font-medium">{skill.name}</p>
                      <p className="mt-1 max-w-3xl text-xs leading-5 text-ink-light">{skill.definition}</p>
                      <p className="mt-2 text-xs leading-5 text-ink-mid"><span className="font-medium">Look for:</span> {skill.observableBehavior}</p>
                    </div>
                    <p className="font-mono text-[10px] uppercase text-ink-light">{skill.category}</p>
                  </div>
                ))}
                <div className="flex flex-wrap gap-x-8 gap-y-2 border-t border-gold/40 py-4 text-xs text-ink-mid">
                  <p><span className="text-ink-light">Timeframe:</span> {snapshot.draft.horizon.replaceAll("-", " ")}</p>
                  <p><span className="text-ink-light">Weekly rhythm:</span> {snapshot.draft.weeklyMinutes} minutes</p>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {snapshot.draft.goal ? (
          <section className="mt-16 border-l-2 border-gold pl-5 sm:pl-8">
            <p className="font-mono text-[10px] uppercase text-ink-light">The goal guiding your journey</p>
            <blockquote className="mt-3 max-w-4xl font-serif text-2xl leading-snug sm:text-3xl">“{snapshot.draft.goal}”</blockquote>
          </section>
        ) : null}
      </div>
    </main>
  );
}