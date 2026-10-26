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
    label: "Roadmap",
    title: "Your roadmap",
    body: "See where you stand, what to build first, and the short path that gets you there.",
    links: [["/journey", "Open my roadmap"], ["/assessment", "Retake the skills check"], ["/profile", "My skills profile"]],
  },
  {
    icon: BookOpen,
    label: "Learning path",
    title: "Your learning path",
    body: "Short lessons in a sensible order, built from experienced professionals' own words.",
    links: [["/lessons", "Browse the learning paths"]],
  },
  {
    icon: Wrench,
    label: "Training material",
    title: "Training material",
    body: "Skill Shots taught by Arya, and hands-on kits to practise on a real problem.",
    links: [["/training", "Open the training material"], ["/skill-shots/root-cause-five-whys", "New: find the cause, not just the symptom"], ["/problem-solving", "Problem Solving kit"]],
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
