import type { Metadata } from "next";

import { SiteHeader } from "@/components/site-header";
import { DemoPortal } from "@/features/capture/ui/DemoPortal";

export const metadata: Metadata = { title: "Demo", robots: { index: false, follow: false } };

export const dynamic = "force-dynamic";

export default function DemoPage() {
  return (
    <main className="min-h-screen bg-cream text-ink">
      <SiteHeader step="Demo" />
      <DemoPortal />
    </main>
  );
}
