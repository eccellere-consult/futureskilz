import type { Metadata } from "next";

import { SiteHeader } from "@/components/site-header";
import { requireRole } from "@/server/auth/require-member";
import { AdminEarnings } from "@/features/capture/ui/AdminEarnings";

export const metadata: Metadata = { title: "Earnings administration" };

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireRole("/contribute/admin", ["admin"]);
  return (
    <main className="min-h-screen bg-cream text-ink">
      <SiteHeader step="Admin" />
      <AdminEarnings />
    </main>
  );
}
