import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Sparkles, Wrench } from "lucide-react";

import { SiteHeader } from "@/components/site-header";
import { skillShots } from "@/features/journey/model";
import { designedSkillShots } from "@/features/skillshot";
import { totalSeconds } from "@/features/skillshot/duration";
import { requireMember } from "@/server/auth/require-member";

export const metadata: Metadata = { title: "Training material" };

export const dynamic = "force-dynamic";

/** Everything a learner can learn from, in one place: Skill Shots taught by Arya, training kits, and coaches' lessons. */
export default async function TrainingPage() {
  await requireMember("/training");
  return (
    <main className="min-h-screen bg-cream text-ink">
      <SiteHeader step="Learner" />
      <div className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        <p className="font-mono text-[10px] uppercase text-gold">Training material</p>
        <h1 className="mt-2 font-display text-4xl font-semibold leading-tight sm:text-5xl">Learn it, then use it.</h1>
        <p className="mt-3 max-w-2xl text-lg leading-8 text-ink-mid">Short lessons taught by Arya, hands-on kits, and lessons from people who have done the work.</p>

        <section aria-label="Skill Shots taught by Arya" className="mt-10">
          <h2 className="flex items-center gap-2 font-display text-2xl"><Sparkles aria-hidden="true" className="text-gold" size={22} /> Skill Shots with Arya</h2>
          <ul className="mt-4 grid gap-px border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
            {designedSkillShots.map((item) => (
              <li key={item.meta.id} className="bg-surface"><Link className="block p-5 hover:bg-gold-pale" href={`/skill-shots/${item.meta.id}`}>
                <span className="font-mono text-[10px] uppercase text-teal">New · about {Math.round(totalSeconds(item) / 60)} min · {item.meta.domain}</span>
                <span className="mt-1 block font-display text-xl leading-snug">{item.meta.title}</span>
                <span className="mt-1 block text-sm leading-6 text-ink-mid">{item.design.learningObjective}</span>
              </Link></li>
            ))}
            {skillShots.map((item) => (
              <li key={item.slug} className="bg-surface"><Link className="block p-5 hover:bg-gold-pale" href={`/skill-shots/${item.slug}`}>
                <span className="font-mono text-[10px] uppercase text-ink-light">{item.durationMinutes} min · {item.pillarId.replaceAll("-", " ")}</span>
                <span className="mt-1 block font-display text-xl leading-snug">{item.title}</span>
                <span className="mt-1 block text-sm leading-6 text-ink-mid">{item.objective}</span>
              </Link></li>
            ))}
          </ul>
        </section>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <section aria-label="Training kits" className="border border-border bg-surface p-6">
            <Wrench aria-hidden="true" className="text-gold" size={24} />
            <h2 className="mt-3 font-display text-2xl">Training kits</h2>
            <p className="mt-2 text-sm leading-6 text-ink-mid">Work a real business problem from definition to a one-page report, one proven method at a time.</p>
            <Link className="primary-button mt-4" href="/problem-solving">Open the Problem Solving kit</Link>
          </section>
          <section aria-label="Coach lessons" className="border border-border bg-surface p-6">
            <BookOpen aria-hidden="true" className="text-gold" size={24} />
            <h2 className="mt-3 font-display text-2xl">Lessons from coaches</h2>
            <p className="mt-2 text-sm leading-6 text-ink-mid">Short lessons built from experienced professionals&apos; own words, in paths for onboarding, readiness and upskilling.</p>
            <Link className="primary-button mt-4" href="/lessons">Browse the learning paths</Link>
          </section>
        </div>
      </div>
    </main>
  );
}
