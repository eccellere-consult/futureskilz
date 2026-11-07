import type { Metadata } from "next";

import { SiteHeader } from "@/components/site-header";
import { requireMember } from "@/server/auth/require-member";

import ProblemSolvingOverview from "./ProblemSolvingOverview";

export const metadata: Metadata = {
  title: "Problem Solving",
  description: "Work a real problem from definition to a one-page report, one proven method at a time.",
};

// Per-person and auth-aware: rendered per request.
export const dynamic = "force-dynamic";

export default async function ProblemSolvingPage({ searchParams }: PageProps<"/problem-solving">) {
  await requireMember("/problem-solving");
  const { case: caseParam } = await searchParams;
  const caseId = typeof caseParam === "string" && /^[0-9]+$/.test(caseParam) ? Number(caseParam) : null;
  return (
    <main className="ws-surface min-h-screen bg-cream text-ink">
      <SiteHeader step="Problem Solving" />
      <ProblemSolvingOverview initialCaseId={caseId} />
    </main>
  );
}
