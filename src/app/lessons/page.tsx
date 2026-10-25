import type { Metadata } from "next";
import Link from "next/link";

import { SiteHeader } from "@/components/site-header";
import { formatDuration } from "@/features/capture/ui/api";
import { learningPaths } from "@/server/capture/lesson-service";

export const metadata: Metadata = {
  title: "Lessons from experienced professionals",
  description: "Short lessons built from the real working knowledge of experienced professionals, in role-based learning paths.",
};

export const dynamic = "force-dynamic";

const GOAL_NOTE: Record<string, string> = {
  onboarding: "For people new to the field or the company.",
  role_readiness: "For people preparing to work independently in the role.",
  upskilling: "For working professionals closing gaps.",
  advanced: "Cases and judgement for people building expertise.",
};

export default async function LessonsPage() {
  const paths = await learningPaths().catch(() => []);
  return (
    <main className="min-h-screen bg-cream text-ink">
      <SiteHeader step="Lessons" />
      <div className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8 sm:py-16">
        <p className="font-mono text-[10px] uppercase text-ink-light">Learn from people who have done the work</p>
        <h1 className="mt-2 max-w-3xl font-display text-4xl font-semibold leading-tight sm:text-6xl">Short lessons. Real experience.</h1>
        <p className="mt-4 max-w-2xl text-lg leading-8 text-ink-mid">Every lesson is built from a contributor&apos;s own words, which they reviewed and approved. Finishing a lesson shows exposure; the check at the end is where you show you can apply it.</p>
        {paths.length === 0 ? <p className="mt-10 border-l-2 border-gold pl-4 text-ink-mid">The first lessons are being prepared with our contributors. Check back soon.</p> : null}
        <div className="mt-10 space-y-10">
          {paths.map((path) => (
            <section key={path.id} aria-label={path.title}>
              <h2 className="font-display text-2xl">{path.title}</h2>
              <p className="text-sm text-ink-light">{GOAL_NOTE[path.goal]} {path.entries.length} lesson{path.entries.length === 1 ? "" : "s"} · about {formatDuration(path.totalSeconds)}</p>
              <ol className="mt-3 divide-y divide-border border border-border bg-surface">
                {path.entries.map((entry, index) => (
                  <li key={entry.slug}>
                    <Link className="flex items-start gap-4 p-4 hover:bg-gold-pale" href={`/lessons/${entry.slug}`}>
                      <span className="font-mono text-xs text-gold">{index + 1}</span>
                      <span>
                        <span className="block font-semibold">{entry.title}</span>
                        <span className="block text-sm text-ink-mid">{entry.objective}</span>
                        <span className="mt-1 block font-mono text-[10px] uppercase text-ink-light">{entry.stage} · {entry.proficiency} · {formatDuration(entry.durationSeconds)}{entry.required ? "" : " · optional"}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
              <p className="mt-2 text-xs text-ink-light">{path.note}</p>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
