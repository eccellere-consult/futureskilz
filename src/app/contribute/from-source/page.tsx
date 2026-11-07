import type { Metadata } from "next";

import { SiteHeader } from "@/components/site-header";
import { SourceStudio } from "@/features/capture/ui/SourceStudio";

export const metadata: Metadata = {
  title: "Start from a document or text",
  description: "Turn a document or your own notes into reviewed lessons, without an interview. You confirm every point before anything is shared.",
};

export const dynamic = "force-dynamic";

export default async function FromSourcePage({ searchParams }: PageProps<"/contribute/from-source">) {
  const { project } = await searchParams;
  return (
    <main className="min-h-screen bg-cream text-ink">
      <SiteHeader step="Contribute" />
      <SourceStudio existingProjectId={typeof project === "string" ? project : null} />
    </main>
  );
}
