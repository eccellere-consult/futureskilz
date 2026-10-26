"use client";

import { ArrowRight, GraduationCap, Mic } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { AryaPanel, useDayPart } from "./AryaPanel";
import { coachWelcome, studentWelcome } from "./scripts";

type Who = "student" | "coach";

/** A public, passwordless introduction: Arya greets the visitor formally and explains what happens next for a learner or a coach. */
export function MeetArya() {
  const part = useDayPart();
  const [who, setWho] = useState<Who>("student");
  const script = who === "student" ? studentWelcome(part) : coachWelcome(part);

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-8 px-5 py-10 sm:px-8 sm:py-16 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-14">
      <section aria-label="Arya" className="bg-ink p-5 text-cream sm:p-8">
        <AryaPanel autoKey={who} className="" script={script} stageClassName="h-80 sm:h-96" />
      </section>
      <section aria-label="Choose how Arya can help">
        <p className="font-mono text-[10px] uppercase text-gold">Meet Arya</p>
        <h1 className="mt-2 font-display text-4xl font-semibold leading-tight sm:text-5xl">Your counsellor, guide and interviewer.</h1>
        <p className="mt-4 text-lg leading-8 text-ink-mid">Arya is an AI. She guides students through a short career conversation, helps coaches register, and interviews coaches so their experience becomes lessons they approve.</p>
        <div className="mt-7 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="I am here as">
          {([["student", "I want to learn", GraduationCap, "Arya asks a few simple questions and builds your first learning path."], ["coach", "I want to coach", Mic, "Arya explains the steps, then interviews you at your pace."]] as const).map(([key, label, Icon, text]) => (
            <button key={key} aria-checked={who === key} className={`border p-4 text-left transition-colors ${who === key ? "border-ink bg-gold-pale" : "border-border bg-surface hover:border-gold"}`} onClick={() => setWho(key)} role="radio" type="button">
              <Icon aria-hidden="true" className="text-gold" size={22} />
              <p className="mt-2 font-serif text-2xl">{label}</p>
              <p className="mt-1 text-sm leading-6 text-ink-mid">{text}</p>
            </button>
          ))}
        </div>
        <Link className="primary-button mt-6" href={`/join?as=${who === "coach" ? "coach" : "learner"}`}>
          {who === "coach" ? "Register as a coach" : "Begin with Arya"} <ArrowRight aria-hidden="true" size={16} />
        </Link>
        <p className="mt-4 max-w-xl text-xs leading-5 text-ink-light">Arya uses your device&apos;s voice or, where the site owner has switched it on, a studio voice. She never records you without your consent, and she cannot publish anything on your behalf.</p>
      </section>
    </div>
  );
}
