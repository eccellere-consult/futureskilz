import type { Metadata } from "next";

import { SiteHeader } from "@/components/site-header";
import { AdminEarnings } from "@/features/capture/ui/AdminEarnings";

export const metadata: Metadata = { title: "Earnings administration" };

export const dynamic = "force-dynamic";

export default function AdminPage() {
  return (
    <main className="min-h-screen bg-cream text-ink">
      <SiteHeader step="Admin" />
      <AdminEarnings />
    </main>
  );
}
