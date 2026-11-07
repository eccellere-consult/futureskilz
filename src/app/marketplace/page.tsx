import type { Metadata } from "next";

import { SiteHeader } from "@/components/site-header";
import { MarketplaceView } from "@/features/marketplace/MarketplaceView";
import { loadListings } from "@/server/marketplace/service";

export const metadata: Metadata = { title: "Marketplace", description: "Lessons from people who have done the work, and Skill Shots taught by Arya. Search by skill, role, industry or level." };
export const dynamic = "force-dynamic";

export default async function MarketplacePage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const q = (await searchParams).q;
  const listings = await loadListings().catch(() => []);
  return (
    <main className="min-h-screen bg-cream text-ink">
      <SiteHeader step="Marketplace" />
      <MarketplaceView initialQuery={(Array.isArray(q) ? q[0] : q)?.slice(0, 80) ?? ""} listings={listings} />
    </main>
  );
}
