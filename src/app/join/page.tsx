import type { Metadata } from "next";

import { SiteHeader } from "@/components/site-header";
import { JoinFlow } from "@/features/learner/join-flow";

export const metadata: Metadata = {
  title: "Register or sign in",
  description: "Join FutureSkilz as a learner or as a coach who shares expertise.",
};

export const dynamic = "force-dynamic";

export default async function JoinPage({ searchParams }: PageProps<"/join">) {
  const { as } = await searchParams;
  return (
    <main className="min-h-screen bg-cream text-ink">
      <SiteHeader />
      <JoinFlow initial={as === "coach" ? "coach" : "learner"} />
    </main>
  );
}
