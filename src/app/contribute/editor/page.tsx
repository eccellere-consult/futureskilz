import type { Metadata } from "next";

import { SiteHeader } from "@/components/site-header";
import { requireRole } from "@/server/auth/require-member";
import { EditorDesk } from "@/features/capture/ui/EditorDesk";

export const metadata: Metadata = { title: "Editor desk" };

export const dynamic = "force-dynamic";

export default async function EditorPage() {
  await requireRole("/contribute/editor", ["editor", "admin"]);
  return (
    <main className="min-h-screen bg-cream text-ink">
      <SiteHeader step="Editor" />
      <EditorDesk />
    </main>
  );
}
