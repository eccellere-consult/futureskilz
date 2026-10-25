import type { Metadata } from "next";

import { SiteHeader } from "@/components/site-header";
import { ContributeHome } from "@/features/capture/ui/ContributeHome";

export const metadata: Metadata = {
  title: "Share your expertise",
  description: "Talk through your career. FutureSkilz turns what you teach into short lessons, keeps your name on them and shows you how they are used.",
};

export const dynamic = "force-dynamic";

export default function ContributePage() {
  return (
    <main className="min-h-screen bg-cream text-ink">
      <SiteHeader step="Contribute" />
      <ContributeHome />
    </main>
  );
}
