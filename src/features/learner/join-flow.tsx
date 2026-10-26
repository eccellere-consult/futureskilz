"use client";

import { GraduationCap, Mic } from "lucide-react";
import { useState } from "react";

import { AryaPanel, useDayPart } from "@/features/arya/AryaPanel";
import { coachWelcome, studentWelcome } from "@/features/arya/scripts";

import { SignInOptions } from "./sign-in-options";

type Path = "learner" | "coach";

const PATHS: Record<Path, { icon: typeof Mic; title: string; body: string; next: string; submit: string; points: string[] }> = {
  learner: {
    icon: GraduationCap,
    title: "I want to learn",
    body: "Find where you stand, get a short personal path, and learn from experienced professionals.",
    next: "/learn",
    submit: "Email me a link to start learning",
    points: ["A few clicks to see your strengths and gaps", "Short lessons from real practitioners", "Your progress follows you to any device"],
  },
  coach: {
    icon: Mic,
    title: "I want to coach",
    body: "Share what your career taught you. Arya, our AI interviewer, interviews you, you approve every word, and your lessons carry your name.",
    next: "/contribute",
    submit: "Email me a link to become a coach",
    points: ["Talk or type; pause and continue another day", "You review and approve everything before it is shared", "See how your lessons are used and how earnings are worked out"],
  },
};

/** One front door for both audiences. The email link registers a new person or signs a returning one in; no password. */
export function JoinFlow({ initial, returnTo }: { initial: Path; returnTo?: string }) {
  const [path, setPath] = useState<Path>(initial);
  const chosen = PATHS[path];
  const dayPart = useDayPart();

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-12 sm:px-8 sm:py-20">
      <p className="font-mono text-[11px] uppercase text-gold">Register or sign in</p>
      <h1 className="mt-3 max-w-3xl font-serif text-5xl leading-none font-light sm:text-6xl">How would you like to use FutureSkilz?</h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-ink-mid">Choose one. You can do both later with the same account, and returning members use the same box to sign in.</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2" role="radiogroup" aria-label="I am here to">
        {(Object.keys(PATHS) as Path[]).map((key) => {
          const option = PATHS[key];
          const active = key === path;
          return (
            <button key={key} aria-checked={active} className={`border p-5 text-left transition-colors ${active ? "border-ink bg-gold-pale" : "border-border bg-surface hover:border-gold"}`} onClick={() => setPath(key)} role="radio" type="button">
              <option.icon aria-hidden="true" className="text-gold" size={26} />
              <p className="mt-3 font-serif text-3xl">{option.title}</p>
              <p className="mt-2 text-sm leading-6 text-ink-mid">{option.body}</p>
              <ul className="mt-3 space-y-1 text-xs text-ink-mid">{option.points.map((point) => <li key={point}>✓ {point}</li>)}</ul>
            </button>
          );
        })}
      </div>

      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,28rem)_minmax(0,1fr)]">
        <section aria-label="Continue with email" className="border-t-2 border-gold bg-surface p-6 shadow-[0_18px_48px_rgba(14,14,13,0.08)]">
          <h2 className="font-serif text-2xl">{path === "coach" ? "Start as a coach" : "Start as a learner"}</h2>
          <div className="mt-4">
            <SignInOptions key={path} includeGuestProgress={path === "learner"} linkLabel={chosen.submit} next={returnTo ?? chosen.next} />
          </div>
        </section>
        <section aria-label="Arya, your guide" className="bg-ink p-4 text-cream sm:p-6">
          <p className="mb-3 font-mono text-[10px] uppercase text-gold-light">Arya will guide you</p>
          <AryaPanel autoKey={path} script={path === "coach" ? coachWelcome(dayPart) : studentWelcome(dayPart)} stageClassName="h-64" />
        </section>
      </div>
    </div>
  );
}
