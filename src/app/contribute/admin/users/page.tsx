import type { Metadata } from "next";

import { SiteHeader } from "@/components/site-header";
import { AdminUsers } from "@/features/capture/ui/AdminUsers";

export const metadata: Metadata = { title: "Accounts" };

export const dynamic = "force-dynamic";

export default function AdminUsersPage() {
  return (
    <main className="min-h-screen bg-cream text-ink">
      <SiteHeader step="Accounts" />
      <AdminUsers />
    </main>
  );
}
