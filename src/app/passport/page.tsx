import type { Metadata } from "next";

import { SiteHeader } from "@/components/site-header";
import { PassportManager } from "@/features/passport/PassportManager";

export const metadata: Metadata = { title: "Skill Passport" };

export default function PassportPage() {
  return (
    <main className="min-h-screen bg-cream text-ink">
      <SiteHeader step="Passport" />
      <PassportManager />
    </main>
  );
}
