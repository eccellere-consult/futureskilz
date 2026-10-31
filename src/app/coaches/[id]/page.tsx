import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SiteHeader } from "@/components/site-header";
import { ListingCard } from "@/features/marketplace/MarketplaceView";
import { getCoachProfile } from "@/server/marketplace/service";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/coaches/[id]">): Promise<Metadata> {
  const profile = await getCoachProfile((await params).id).catch(() => null);
  return profile ? { title: `${profile.name}, coach on FutureSkilz`, description: profile.headline ?? `Lessons by ${profile.name}.` } : {};
}

export default async function CoachPage({ params }: PageProps<"/coaches/[id]">) {
  const profile = await getCoachProfile((await params).id).catch(() => null);
  if (!profile) notFound();
  return (
    <main className="min-h-screen bg-cream text-ink">
      <SiteHeader step="Coach" />
      <div className="mx-auto w-full max-w-4xl px-5 py-10 sm:px-8 sm:py-14">
        <p className="font-mono text-[10px] uppercase text-teal">Coach</p>
        <h1 className="mt-2 font-serif text-4xl leading-tight sm:text-5xl">{profile.name}</h1>
        {profile.headline ? <p className="mt-2 text-lg text-ink-mid">{profile.headline}</p> : null}
        <dl className="mt-6 grid grid-cols-2 gap-px border border-border bg-border sm:max-w-md">
          <div className="bg-surface p-4"><dt className="font-mono text-[10px] uppercase text-ink-light">Live lessons</dt><dd className="mt-1 font-serif text-3xl">{profile.lessons.length}</dd></div>
          <div className="bg-surface p-4"><dt className="font-mono text-[10px] uppercase text-ink-light">Learners reached</dt><dd className="mt-1 font-serif text-3xl">{profile.learnersReached}</dd></div>
        </dl>
        <section aria-label="Reputation" className="mt-6 max-w-2xl border border-border bg-surface p-4">
          <p className="font-mono text-[10px] uppercase text-ink-light">Reputation</p>
          {profile.reputation.score === null ? (
            <p className="mt-1 text-sm text-ink-mid">Not yet rated. There is not enough learner activity behind a score, and a new coach is not a low-scoring one.</p>
          ) : (
            <>
              <p className="mt-1 font-serif text-3xl">{profile.reputation.score}<span className="ml-2 text-sm text-ink-mid capitalize">{profile.reputation.tier}</span></p>
              <ul className="mt-2 grid gap-1 text-xs text-ink-mid sm:grid-cols-2">{profile.reputation.parts.map((part) => <li key={part.key}>{part.label}: {part.points} of {part.max}<span className="block text-ink-light">{part.note}</span></li>)}</ul>
              {profile.reputation.note ? <p className="mt-2 text-xs text-ink-light">{profile.reputation.note}</p> : null}
            </>
          )}
          <p className="mt-2 text-xs text-ink-light">Built from learners finishing and rating after they finish, review checks and fraud review. Ratings are at most 30 of the 100 points.</p>
        </section>
        <p className="mt-3 max-w-2xl text-xs leading-5 text-ink-light">Every lesson here was built from {profile.name}&apos;s own experience, and approved by them before it went live. Quality shows what learners and checks say; it is not a star rating.</p>
        <h2 className="mt-10 font-display text-2xl">Lessons</h2>
        <ul className="mt-4 space-y-4">{profile.lessons.map((listing) => <li key={listing.id}><ListingCard listing={listing} /></li>)}</ul>
      </div>
    </main>
  );
}
