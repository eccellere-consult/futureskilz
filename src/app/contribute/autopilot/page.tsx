import type { Metadata } from "next";

import { SiteHeader } from "@/components/site-header";
import { AutopilotResults } from "@/features/capture/ui/AutopilotResults";
import { requireRole } from "@/server/auth/require-member";

export const metadata: Metadata = { title: "Autopilot results" };
export const dynamic = "force-dynamic";

export default async function AutopilotResultsPage() {
  await requireRole("/contribute/autopilot", ["editor", "admin"]);
  return (
    <main className="min-h-screen bg-cream text-ink">
      <SiteHeader step="Autopilot" />
      <AutopilotResults />
    </main>
  );
}
