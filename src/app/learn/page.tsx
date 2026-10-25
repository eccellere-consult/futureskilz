import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Compass, Wrench } from "lucide-react";

import { SiteHeader } from "@/components/site-header";
import { requireMember } from "@/server/auth/require-member";

export const metadata: Metadata = { title: "My learning" };

export const dynamic = "force-dynamic";

const AREAS = [
  {
    icon: Compass,
    label: "Skills",
    title: "Your skills and journey",
    body: "See where you stand, what to build next, and the short Skill Shots that move you forward.",
    links: [["/journey", "Open my journey"], ["/assessment", "Retake the skills check"], ["/profile", "My profile"]],
  },
  {
    icon: Wrench,
    label: "Training kits",
    title: "Problem Solving kit",
    body: "Work a real business problem from definition to a one-page report, one proven method at a time. More kits will join this shelf.",
    links: [["/problem-solving", "Open the Problem Solving kit"], ["/problem-solving/5w2h?demo=1", "See a worked example first"]],
  },
  {
    icon: BookOpen,
    label: "Coach lessons",
    title: "Learn from people who have done the work",
    body: "Short lessons built from experienced professionals' own words, in paths for onboarding, readiness and upskilling.",
    links: [["/lessons", "Browse the lesson paths"]],
  },
] as const;

export default async function LearnPage() {
  const session = await requireMember("/learn");
  return (
    <main className="min-h-screen bg-cream text-ink">
      <SiteHeader step="My learning" />
      <div className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8 sm:py-16">
        <p className="font-mono text-[10px] uppercase text-gold">Members area</p>
        <h1 className="mt-2 font-display text-4xl font-semibold leading-tight sm:text-6xl">Welcome, {session.user.displayName.split(" ")[0]}.</h1>
        <p className="mt-3 max-w-2xl text-lg leading-8 text-ink-mid">Everything you learn and practise lives here, saved to your account.</p>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {AREAS.map((area) => (
            <section key={area.title} aria-label={area.label} className="flex flex-col border border-border bg-surface p-6">
              <area.icon aria-hidden="true" className="text-gold" size={26} />
              <p className="mt-4 font-mono text-[10px] uppercase text-ink-light">{area.label}</p>
              <h2 className="mt-1 font-display text-2xl leading-snug">{area.title}</h2>
              <p className="mt-2 flex-1 text-sm leading-6 text-ink-mid">{area.body}</p>
              <ul className="mt-4 space-y-2 text-sm">
                {area.links.map(([href, label], index) => <li key={href}><Link className={index === 0 ? "primary-button w-full" : "text-teal underline underline-offset-4"} href={href}>{label}</Link></li>)}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
