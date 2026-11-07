import type { Metadata } from "next";

import { SiteHeader } from "@/components/site-header";
import { PricingView } from "@/features/payments/ui/PricingView";

export const metadata: Metadata = { title: "Plans and billing" };

export const dynamic = "force-dynamic";

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-cream text-ink">
      <SiteHeader step="Plans" />
      <PricingView />
    </main>
  );
}
