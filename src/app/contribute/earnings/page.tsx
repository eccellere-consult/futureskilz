import type { Metadata } from "next";

import { SiteHeader } from "@/components/site-header";
import { EarningsCalculator } from "@/features/capture/ui/EarningsCalculator";
import { requireRole } from "@/server/auth/require-member";

export const metadata: Metadata = { title: "Earnings calculator" };

export const dynamic = "force-dynamic";

export default async function EarningsPage() {
  await requireRole("/contribute/earnings", ["contributor", "editor", "admin"]);
  return (
    <main className="min-h-screen bg-cream text-ink">
      <SiteHeader step="Coach" />
      <EarningsCalculator />
    </main>
  );
}
