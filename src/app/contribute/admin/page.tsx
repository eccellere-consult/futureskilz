import type { Metadata } from "next";

import { SiteHeader } from "@/components/site-header";
import { requireRole } from "@/server/auth/require-member";
import { AdminCampaigns } from "@/features/capture/ui/AdminCampaigns";
import { AdminEarnings } from "@/features/capture/ui/AdminEarnings";
import { AdminFraud } from "@/features/capture/ui/AdminFraud";

export const metadata: Metadata = { title: "Earnings administration" };

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireRole("/contribute/admin", ["admin"]);
  return (
    <main className="min-h-screen bg-cream text-ink">
      <SiteHeader step="Admin" />
      <AdminEarnings />
      <div className="mx-auto w-full max-w-6xl px-5 pb-16 sm:px-8"><AdminFraud /><AdminCampaigns /></div>
    </main>
  );
}
