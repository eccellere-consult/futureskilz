import type { Metadata } from "next";

import { SiteHeader } from "@/components/site-header";
import { ReviewWorkspace } from "@/features/capture/ui/ReviewWorkspace";

export const metadata: Metadata = { title: "Check what I heard" };

export const dynamic = "force-dynamic";

export default async function ReviewPage({ params }: PageProps<"/contribute/[projectId]/review">) {
  const { projectId } = await params;
  return (
    <main className="min-h-screen bg-cream text-ink">
      <SiteHeader step="Review" />
      <ReviewWorkspace projectId={projectId} />
    </main>
  );
}
