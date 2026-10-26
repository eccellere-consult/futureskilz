"use client";

import { SiteHeader } from "@/components/site-header";
import { DiagnosticConversation } from "@/features/diagnostic/DiagnosticConversation";
import { useLearnerState } from "@/features/learner/use-learner-state";

export default function DeeperAssessmentPage() {
  const { state, error } = useLearnerState();
  return (
    <main className="min-h-screen bg-cream text-ink">
      <SiteHeader step="Assess · 02" />
      {error ? <p className="mx-auto max-w-2xl px-5 py-24 text-center text-sm text-ink-mid" role="alert">{error}</p> : state ? <DiagnosticConversation snapshot={state.snapshot} /> : <div aria-label="Loading" className="min-h-96" />}
    </main>
  );
}
