import type { Metadata } from "next";

import { SiteHeader } from "@/components/site-header";
import { MeetArya } from "@/features/arya/MeetArya";

export const metadata: Metadata = { title: "Meet Arya" };

export default function AryaPage() {
  return (
    <main className="min-h-screen bg-cream text-ink">
      <SiteHeader step="Meet Arya" />
      <MeetArya />
    </main>
  );
}
