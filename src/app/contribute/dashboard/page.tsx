import type { Metadata } from "next";

import { SiteHeader } from "@/components/site-header";
import { requireRole } from "@/server/auth/require-member";
import { Dashboard } from "@/features/capture/ui/Dashboard";

export const metadata: Metadata = { title: "Contributor dashboard" };

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  await requireRole("/contribute/dashboard", ["contributor", "editor", "admin"]);
  return (
    <main className="min-h-screen bg-cream text-ink">
      <SiteHeader step="Dashboard" />
      <Dashboard />
    </main>
  );
}
