import type { Metadata } from "next";

import { SiteHeader } from "@/components/site-header";
import { CoachLog } from "@/features/coach/CoachLog";

export const metadata: Metadata = { title: "Conversations with Arya" };
export const dynamic = "force-dynamic";

export default function CoachLogPage() {
  return (
    <main className="min-h-screen bg-cream text-ink">
      <SiteHeader step="Skill Shot studio" />
      <CoachLog />
    </main>
  );
}
