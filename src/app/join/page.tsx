import type { Metadata } from "next";

import { SiteHeader } from "@/components/site-header";
import { safeRedirectPath } from "@/server/auth/magic-link";
import { demoEnabled } from "@/server/demo/access";
import { JoinFlow } from "@/features/learner/join-flow";

export const metadata: Metadata = {
  title: "Register or sign in",
  description: "Join FutureSkilz as a learner or as a coach who shares expertise.",
};

export const dynamic = "force-dynamic";

export default async function JoinPage({ searchParams }: PageProps<"/join">) {
  const { as, next } = await searchParams;
  const returnTo = typeof next === "string" && next.startsWith("/") ? safeRedirectPath(next) : undefined;
  return (
    <main className="min-h-screen bg-cream text-ink">
      <SiteHeader />
      <JoinFlow initial={as === "coach" ? "coach" : "learner"} returnTo={returnTo} demo={demoEnabled()} />
    </main>
  );
}
