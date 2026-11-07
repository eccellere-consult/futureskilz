import type { Metadata } from "next";

import { SiteHeader } from "@/components/site-header";
import { AdminDashboard } from "@/features/capture/ui/AdminDashboard";
import { requireRole } from "@/server/auth/require-member";

export const metadata: Metadata = { title: "Admin dashboard" };

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  await requireRole("/admin", ["admin"]);
  return (
    <main className="min-h-screen bg-cream text-ink">
      <SiteHeader step="Admin" />
      <AdminDashboard />
    </main>
  );
}
