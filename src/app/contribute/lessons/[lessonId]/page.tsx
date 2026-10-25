import type { Metadata } from "next";

import { SiteHeader } from "@/components/site-header";
import { LessonWorkspace } from "@/features/capture/ui/LessonWorkspace";

export const metadata: Metadata = { title: "Lesson review" };

export const dynamic = "force-dynamic";

export default async function LessonReviewPage({ params }: PageProps<"/contribute/lessons/[lessonId]">) {
  const { lessonId } = await params;
  return (
    <main className="min-h-screen bg-cream text-ink">
      <SiteHeader step="Lesson review" />
      <LessonWorkspace lessonId={lessonId} />
    </main>
  );
}
