"use client";

import { ArrowRight, GraduationCap, Mic, PenLine, Settings } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Avatar } from "@/features/capture/ui/Avatar";
import { LessonPlayer } from "@/features/capture/ui/LessonPlayer";

import { JOURNEY, PILLARS, SAMPLE_LESSON } from "./fixtures";

type PersonaId = "learner" | "coach" | "editor" | "admin";

const PERSONAS: Array<{ id: PersonaId; label: string; icon: typeof Mic; headline: string; cta: { label: string; href: string } }> = [
  { id: "learner", label: "Learner", icon: GraduationCap, headline: "Know where you stand and what to learn next, then learn from people who have done the work.", cta: { label: "Register as a learner", href: "/join" } },
  { id: "coach", label: "Coach", icon: Mic, headline: "Talk through your career. Approve every word. Watch your lessons help people, and see how your credit is worked out.", cta: { label: "Register as a coach", href: "/join?as=coach" } },
  { id: "editor", label: "Editor", icon: PenLine, headline: "Turn approved expertise into polished lessons, with every claim traced to its source.", cta: { label: "Ask to join as an editor", href: "/join" } },
  { id: "admin", label: "Admin", icon: Settings, headline: "Set the rules, approve them, and run fair, auditable earnings and accounts.", cta: { label: "Talk to us about your organisation", href: "/join" } },
];

type Step = { id: string; title: string; caption: string; url: string; render: () => React.ReactNode };

const Frame = ({ url, children }: { url: string; children: React.ReactNode }) => (
  <div className="overflow-hidden border border-ink bg-cream shadow-[0_18px_48px_rgba(14,14,13,0.12)]">
    <div className="flex items-center gap-2 border-b border-border bg-ink px-3 py-2">
      <span className="flex gap-1" aria-hidden="true"><i className="h-2 w-2 rounded-full bg-cream/30" /><i className="h-2 w-2 rounded-full bg-cream/30" /><i className="h-2 w-2 rounded-full bg-cream/30" /></span>
      <span className="truncate font-mono text-[10px] text-cream/70">futureskilz.in{url}</span>
      <span className="ml-auto shrink-0 border border-gold/50 px-1.5 py-0.5 font-mono text-[9px] uppercase text-gold-light">Sample data</span>
    </div>
    <div className="max-h-136 overflow-y-auto">{children}</div>
  </div>
);

const th = "p-2.5 font-mono text-[10px] uppercase text-ink-light";

const STEPS: Record<PersonaId, Step[]> = {
  learner: [
    {
      id: "profile", title: "Your skills profile", caption: "A few clicks, no long form. Scores show how sure we are, and where each came from.", url: "/journey",
      render: () => (
        <div className="p-5">
          <p className="font-mono text-[10px] uppercase text-gold">Your starting point</p>
          <h3 className="mt-1 font-display text-2xl">Strong with people. Critical thinking is the quickest gain.</h3>
          <ul className="mt-4 space-y-3">
            {PILLARS.map((pillar) => (
              <li key={pillar.name}>
                <div className="flex justify-between text-sm"><span className="font-semibold">{pillar.name}</span><span className="text-ink-light">{pillar.score}/100</span></div>
                <div className="mt-1 h-2 bg-border"><div className="h-2 bg-gold" style={{ width: `${pillar.score}%` }} /></div>
                <p className="mt-0.5 text-xs text-ink-light">{pillar.note}</p>
              </li>
            ))}
          </ul>
          <p className="mt-4 border-l-2 border-gold pl-3 text-xs leading-5 text-ink-mid">What I heard: you plan production and want to run the weekly plan alone. What it may mean: critical thinking and decisions matter most now. Still uncertain: how you perform under pressure. Next: two short Skill Shots.</p>
        </div>
      ),
    },
    {
      id: "journey", title: "Your personal journey", caption: "A short path built from your gaps and your time, mixing Skill Shots and coach lessons.", url: "/journey",
      render: () => (
        <div className="p-5">
          <p className="font-mono text-[10px] uppercase text-gold">Your first learning route</p>
          <h3 className="mt-1 font-display text-2xl">Three focused moves, about 10 minutes</h3>
          <ol className="mt-4 divide-y divide-border border border-border bg-surface">
            {JOURNEY.map((step, index) => (
              <li key={step.title} className="flex items-start gap-3 p-3">
                <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center text-xs font-bold ${step.status === "Completed" ? "bg-teal text-cream" : "border border-ink"}`}>{step.status === "Completed" ? "✓" : index + 1}</span>
                <div className="flex-1"><p className="font-semibold">{step.title}</p><p className="text-xs text-ink-mid">{step.why}</p></div>
                <span className="font-mono text-[10px] uppercase text-ink-light">{step.status} · {step.minutes} min</span>
              </li>
            ))}
          </ol>
        </div>
      ),
    },
    { id: "lesson", title: "A lesson from a coach", caption: "Try it: step through the scenes, read the captions, and do the check. This is the real lesson player.", url: "/lessons/weekly-planning", render: () => <LessonPlayer preview spec={SAMPLE_LESSON} /> },
    {
      id: "kit", title: "Practise on a real problem", caption: "Training kits let you work your own problem, one proven method at a time.", url: "/problem-solving",
      render: () => (
        <div className="p-5">
          <p className="font-mono text-[10px] uppercase text-gold">Training kit</p>
          <h3 className="mt-1 font-display text-2xl">Problem Solving</h3>
          <div className="mt-4 border border-border bg-surface p-4"><p className="text-xs text-ink-light">My problem</p><p className="font-semibold">Late changes to the frozen weekly plan</p></div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {[["5W2H", "Describe the problem with facts, a place, a time and a size.", "Start here"], ["5 Whys", "Ask why until you reach a cause you can act on.", "Next"]].map(([name, body, tag]) => (
              <div key={name} className="border border-border bg-surface p-3"><div className="flex justify-between"><p className="font-display text-xl">{name}</p><span className="border border-border px-1.5 py-0.5 text-[10px] text-ink-light">{tag}</span></div><p className="mt-1 text-xs text-ink-mid">{body}</p></div>
            ))}
          </div>
        </div>
      ),
    },
  ],
  coach: [
    {
      id: "talk", title: "A conversation, not a form", caption: "An AI companion asks one question at a time. Speak or type, pause, and carry on another day.", url: "/contribute/interview",
      render: () => (
        <div>
          <div className="grid sm:grid-cols-[1fr_11rem] bg-ink text-cream">
            <Avatar listening={false} speaking={false} />
            <div className="border-t border-cream/15 p-4 text-xs sm:border-l sm:border-t-0"><p className="font-mono text-[10px] uppercase text-gold-light">You</p><div className="mt-2 grid h-16 place-items-center border border-cream/20">🎙</div><p className="mt-2 text-cream/70">Microphone off. Speak or type.</p></div>
          </div>
          <div className="bg-purple p-5 text-cream"><p className="font-mono text-[10px] uppercase text-gold-light">Processes and how-to</p><p className="mt-2 font-display text-2xl leading-snug">Walk me through the steps in order. Who does each step, and what rules guide the decisions?</p><p className="mt-2 text-sm text-cream/70"><b className="text-cream/90">Why I ask:</b> An ordered sequence with owners is what makes a how-to usable.</p></div>
          <div className="p-4 text-sm text-ink-light">Skip for now · I am not sure · This is confidential · Come back later</div>
        </div>
      ),
    },
    {
      id: "review", title: "Check what was heard", caption: "Every statement shows the exact words it came from. Confirm, correct or reject. Nothing is shared without you.", url: "/contribute/review",
      render: () => (
        <div className="space-y-3 p-5">
          <div className="border border-border bg-surface p-4">
            <div className="flex flex-wrap gap-2 text-[11px]"><span className="border border-border px-2 py-0.5">Not yet reviewed</span><span className="border border-border px-2 py-0.5">Your words</span></div>
            <p className="mt-2 font-semibold">Steps, owners and decision rules</p>
            <p className="mt-1 text-sm leading-6">First, the planner reviews demand against the last four weeks. Second, they check capacity line by line…</p>
            <p className="mt-2 border-l-2 border-border pl-3 text-xs text-ink-mid"><span className="font-mono text-[10px] uppercase text-ink-light">S18 · you said · 25 Oct</span><br />“First, the planner reviews demand against the last four weeks.”</p>
            <div className="mt-3 flex gap-2 text-sm"><span className="bg-gold px-3 py-1.5 font-bold">That is right</span><span className="border border-ink px-3 py-1.5">Correct it</span><span className="px-3 py-1.5 text-crimson underline">I did not mean this</span></div>
          </div>
          <p className="text-xs text-ink-mid">Sensitive details can be shared, shared anonymised, or kept private. You approve the package before any lesson is created.</p>
        </div>
      ),
    },
    {
      id: "usage", title: "See how your lessons are used", caption: "Usage is recorded from the first view, with your credit on every lesson.", url: "/contribute/dashboard",
      render: () => (
        <div className="p-5">
          <dl className="grid grid-cols-4 gap-px border border-border bg-border text-center">{[["Lessons", "14"], ["Live", "11"], ["Learners", "8"], ["Completions", "46"]].map(([k, v]) => <div key={k} className="bg-surface p-3"><dt className="font-mono text-[10px] uppercase text-ink-light">{k}</dt><dd className="font-display text-2xl">{v}</dd></div>)}</dl>
          <table className="mt-4 w-full text-left text-sm"><thead className="border-b border-border"><tr><th className={th}>Lesson</th><th className={th}>Credit</th><th className={th}>Done</th><th className={th}>Useful</th></tr></thead>
            <tbody>{[["How the work flows", "60%", "5", "3.4 (5)"], ["Weekly planning how-to", "100%", "4", "3.5 (4)"], ["What experts notice", "100%", "3", "3.3 (3)"]].map((r) => <tr key={r[0]} className="border-b border-border">{r.map((c, i) => <td key={i} className="p-2.5">{c}</td>)}</tr>)}</tbody></table>
        </div>
      ),
    },
    {
      id: "earn", title: "Understand your earnings", caption: "Rules are versioned and approved. Every statement shows its inputs and how each line was worked out.", url: "/contribute/dashboard",
      render: () => (
        <div className="p-5 text-sm">
          <div className="flex items-end justify-between"><div><p className="font-semibold">Statement: last 30 days</p><p className="text-xs text-ink-light">Preview only until rules are approved</p></div><p className="font-display text-3xl">₹1,240.00</p></div>
          <p className="mt-3 text-xs leading-5 text-ink-mid">Policy sample-1 · eligible receipts after refunds, fees and tax · pool shared by time spent, completions, use of materials and usefulness. Ratings count only for learners who completed a lesson.</p>
          <table className="mt-3 w-full text-left text-xs"><thead><tr><th className={th}>Lesson</th><th className={th}>Your credit</th><th className={th}>Your amount</th></tr></thead><tbody>{[["Weekly planning how-to", "100%", "₹610"], ["How the work flows", "60%", "₹390"], ["Reading the scorecard", "100%", "₹240"]].map((r) => <tr key={r[0]} className="border-t border-border">{r.map((c, i) => <td key={i} className="p-2.5">{c}</td>)}</tr>)}</tbody></table>
        </div>
      ),
    },
  ],
  editor: [
    {
      id: "queue", title: "From approved knowledge to lessons", caption: "Lessons are drafted only from statements the coach confirmed and cleared for sharing.", url: "/contribute/editor",
      render: () => (
        <div className="p-5"><p className="text-sm"><b>Approved interview:</b> My career in production planning · 14 lessons drafted, 11 live</p>
          <table className="mt-3 w-full text-left text-sm"><thead className="border-b border-border"><tr><th className={th}>Lesson</th><th className={th}>Stage</th><th className={th}>Status</th><th className={th}>Checks</th></tr></thead>
            <tbody>{[["The industry in plain words", "Context", "Live", "Pass"], ["Exceptions and mistakes", "Exceptions", "With an editor", "Pass"], ["What experts notice", "Practice", "Waiting for coach", "Pass"], ["Case: a challenge", "Advanced", "Draft", "1 to fix"]].map((r) => <tr key={r[0]} className="border-b border-border">{r.map((c, i) => <td key={i} className="p-2.5">{c}</td>)}</tr>)}</tbody></table></div>
      ),
    },
    {
      id: "review", title: "Review a lesson", caption: "Mechanical checks, sources and credit sit beside the preview. Publishing needs the editor and the coach.", url: "/contribute/lessons/…",
      render: () => (
        <div className="grid gap-4 p-5 sm:grid-cols-2 text-sm">
          <div><p className="font-display text-xl">Checks before publishing</p><ul className="mt-2 space-y-1.5 text-xs">{[["✓", "Built from an approved knowledge package"], ["✓", "Every fact cleared for sharing"], ["✓", "Objective, length, sources and screen text"], ["✓", "Captions available"], ["✓", "Attribution adds up to 100%"], ["•", "Editor approval"], ["•", "Coach approval"]].map(([m, t]) => <li key={t}><span className={m === "✓" ? "text-teal" : "text-gold"}>{m}</span> {t}</li>)}</ul></div>
          <div><p className="font-display text-xl">Who is credited</p><p className="mt-2 text-xs">Asha Rao 60% · Ravi Menon 40% (co-author)</p><p className="mt-3 bg-gold px-3 py-2 text-center text-xs font-bold">Approve as editor</p></div>
        </div>
      ),
    },
  ],
  admin: [
    {
      id: "policy", title: "Set the rules", caption: "No formula is built in. You choose it, approve a version, and approved versions never change.", url: "/contribute/admin",
      render: () => (
        <div className="p-5 text-sm"><p className="font-display text-xl">Policy versions</p><div className="mt-2 border border-border bg-surface p-3"><p className="font-semibold">sample-1 · approved</p><p className="text-xs text-ink-mid">Pool 40% of receipts after refunds, fees and tax · time 35%, completions 25%, materials 20%, usefulness 20% (ratings capped at 30%) · hold 30 days</p></div><p className="mt-3 text-xs text-ink-mid">Ratings alone can never decide earnings. Repeat events beyond the daily cap are recorded but not counted.</p></div>
      ),
    },
    {
      id: "run", title: "Run a period", caption: "Apply the policy to receipts and learner activity. Every run has a fingerprint, so it can be reproduced.", url: "/contribute/admin",
      render: () => (
        <div className="p-5 text-sm"><p className="text-xs text-ink-mid">Receipts counted 3 · eligible net ₹21,300 · pool ₹8,520 · events counted 412 (31 not counted) · fingerprint 9c4e1ab07d52</p>
          <table className="mt-3 w-full text-left text-xs"><thead><tr><th className={th}>Lesson</th><th className={th}>Time</th><th className={th}>Completed</th><th className={th}>Allocation</th></tr></thead><tbody>{[["Weekly planning how-to", "28 min", "4", "₹1,740"], ["How the work flows", "27 min", "5", "₹2,010"], ["Reading the scorecard", "23 min", "3", "₹1,120"]].map((r) => <tr key={r[0]} className="border-t border-border">{r.map((c, i) => <td key={i} className="p-2.5">{c}</td>)}</tr>)}</tbody></table></div>
      ),
    },
    {
      id: "people", title: "Manage people and roles", caption: "Create accounts for each role, reset passwords, suspend access. Everything is audited.", url: "/contribute/admin/users",
      render: () => (
        <div className="p-5"><table className="w-full text-left text-sm"><thead className="border-b border-border"><tr><th className={th}>Person</th><th className={th}>Roles</th><th className={th}>Password</th><th className={th}>Status</th></tr></thead><tbody>{[["Asha Rao", "Coach", "Emailed link", "active"], ["Edith Nair", "Editor", "Set", "active"], ["Adam Khan", "Admin", "Set", "active"], ["Meera Iyer", "Learner", "Emailed link", "active"]].map((r) => <tr key={r[0]} className="border-b border-border">{r.map((c, i) => <td key={i} className="p-2.5">{c}</td>)}</tr>)}</tbody></table></div>
      ),
    },
  ],
};

/** What you get after registering, shown with sample data and no sign-in. Nothing here is saved or sent anywhere. */
export function ProductTour({ id = "see-it" }: { id?: string }) {
  const [persona, setPersona] = useState<PersonaId>("learner");
  const [stepIndex, setStepIndex] = useState(0);
  const steps = STEPS[persona];
  const step = steps[Math.min(stepIndex, steps.length - 1)];
  const current = PERSONAS.find((item) => item.id === persona)!;

  return (
    <section aria-label="See what you get" className="border-t border-border bg-cream" id={id}>
      <div className="mx-auto w-full max-w-7xl px-5 py-14 sm:px-8 sm:py-20">
        <p className="font-mono text-[11px] uppercase text-gold">See it before you register</p>
        <h2 className="mt-3 max-w-3xl font-serif text-4xl leading-tight font-light sm:text-5xl">This is what you get after you register.</h2>
        <p className="mt-3 max-w-2xl text-ink-mid">Pick who you are and click through the real screens. Sample data, nothing to sign in to, nothing saved.</p>

        <div className="mt-8 flex flex-wrap gap-2" role="tablist" aria-label="Who are you?">
          {PERSONAS.map((item) => (
            <button key={item.id} aria-selected={persona === item.id} className={`inline-flex min-h-11 items-center gap-2 border px-4 text-sm font-semibold ${persona === item.id ? "border-ink bg-ink text-cream" : "border-border bg-surface hover:border-gold"}`} onClick={() => { setPersona(item.id); setStepIndex(0); }} role="tab" type="button">
              <item.icon aria-hidden="true" size={16} /> {item.label}
            </button>
          ))}
        </div>
        <p className="mt-4 max-w-3xl font-serif text-2xl leading-snug">{current.headline}</p>

        <div className="mt-6 grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)]">
          <ol className="space-y-2" aria-label="Steps">
            {steps.map((item, index) => (
              <li key={item.id}>
                <button aria-current={index === stepIndex} className={`w-full border p-3 text-left ${index === stepIndex ? "border-ink bg-gold-pale" : "border-border bg-surface hover:border-gold"}`} onClick={() => setStepIndex(index)} type="button">
                  <span className="font-mono text-[10px] uppercase text-ink-light">Step {index + 1}</span>
                  <span className="block font-semibold">{item.title}</span>
                  {index === stepIndex ? <span className="mt-1 block text-xs leading-5 text-ink-mid">{item.caption}</span> : null}
                </button>
              </li>
            ))}
            <li><Link className="primary-button mt-2 w-full" href={current.cta.href}>{current.cta.label} <ArrowRight aria-hidden="true" size={16} /></Link></li>
          </ol>
          <Frame url={step.url}>{step.render()}</Frame>
        </div>
      </div>
    </section>
  );
}
