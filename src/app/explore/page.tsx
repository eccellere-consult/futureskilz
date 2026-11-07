"use client";

import Link from "next/link";

import { SiteHeader } from "@/components/site-header";
import { useLearnerState } from "@/features/learner/use-learner-state";
import { ExplorerView } from "@/features/pathway/ExplorerView";

export default function ExplorePage() {
  const { state, error } = useLearnerState();
  const snapshot = state?.snapshot;
  return (
    <main className="min-h-screen bg-cream text-ink">
      <SiteHeader step="Explore" />
      {error ? <p className="mx-auto max-w-2xl px-5 py-24 text-center text-sm text-ink-mid" role="alert">{error}</p> : !snapshot ? <div aria-label="Loading" className="min-h-96" /> : !snapshot.scores ? (
        <div className="mx-auto max-w-2xl px-5 py-24 text-center sm:px-8">
          <h1 className="font-serif text-4xl">The explorer needs a first picture of your skills.</h1>
          <p className="mt-3 text-ink-mid">Take the short snapshot, or the five-minute conversation, and then see which roles are near.</p>
          <Link className="primary-button mt-8" href="/assessment">Take the snapshot</Link>
        </div>
      ) : <ExplorerView snapshot={snapshot} />}
    </main>
  );
}
