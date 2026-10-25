"use client";

import { GraduationCap, Mic } from "lucide-react";
import { useState } from "react";

import { SignInForm } from "./sign-in-form";

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
    body: "Share what your career taught you. An AI companion interviews you, you approve every word, and your lessons carry your name.",
    next: "/contribute",
    submit: "Email me a link to become a coach",
    points: ["Talk or type; pause and continue another day", "You review and approve everything before it is shared", "See how your lessons are used and how earnings are worked out"],
  },
};

/** One front door for both audiences. The email link registers a new person or signs a returning one in; no password. */
export function JoinFlow({ initial, returnTo, demo = false }: { initial: Path; returnTo?: string; demo?: boolean }) {
  const [path, setPath] = useState<Path>(initial);
  const chosen = PATHS[path];

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

      <section aria-label="Continue with email" className="mt-8 max-w-md border-t-2 border-gold bg-surface p-6 shadow-[0_18px_48px_rgba(14,14,13,0.08)]">
        <h2 className="font-serif text-2xl">{path === "coach" ? "Start as a coach" : "Start as a learner"}</h2>
        <div className="mt-4">
          <SignInForm key={path} includeGuestProgress={path === "learner"} next={returnTo ?? chosen.next} submitLabel={chosen.submit} />
        </div>
      </section>
      {demo ? (
        <p className="mt-5 max-w-md text-sm text-ink-mid">
          Trying the demo? <a className="font-semibold text-teal underline underline-offset-4" href="/demo">Sign in with a demo email and password</a>.
        </p>
      ) : null}
    </div>
  );
}
