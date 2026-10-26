import type { Metadata } from "next";

import { SiteHeader } from "@/components/site-header";
import { requireRole } from "@/server/auth/require-member";
import { AdminUsers } from "@/features/capture/ui/AdminUsers";

export const metadata: Metadata = { title: "Accounts" };

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  await requireRole("/contribute/admin/users", ["admin"]);
  return (
    <main className="min-h-screen bg-cream text-ink">
      <SiteHeader step="Accounts" />
      <AdminUsers />
    </main>
  );
}
