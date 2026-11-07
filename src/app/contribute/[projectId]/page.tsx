import type { Metadata } from "next";

import { SiteHeader } from "@/components/site-header";
import { InterviewStudio } from "@/features/capture/ui/InterviewStudio";

export const metadata: Metadata = { title: "Your conversation" };

export const dynamic = "force-dynamic";

export default async function InterviewPage({ params }: PageProps<"/contribute/[projectId]">) {
  const { projectId } = await params;
  return (
    <main className="min-h-screen bg-cream text-ink">
      <SiteHeader step="Interview" />
      <InterviewStudio projectId={projectId} />
    </main>
  );
}
