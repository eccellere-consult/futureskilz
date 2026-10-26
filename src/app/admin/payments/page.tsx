import type { Metadata } from "next";

import { SiteHeader } from "@/components/site-header";
import { AdminPayments } from "@/features/capture/ui/AdminPayments";
import { requireRole } from "@/server/auth/require-member";

export const metadata: Metadata = { title: "Payments" };

export const dynamic = "force-dynamic";

export default async function PaymentsPage() {
  await requireRole("/admin/payments", ["admin"]);
  return (
    <main className="min-h-screen bg-cream text-ink">
      <SiteHeader step="Admin" />
      <AdminPayments />
    </main>
  );
}
