import type { Metadata } from "next";

import { SiteHeader } from "@/components/site-header";
import { DraftReview } from "@/features/skillshot/studio/DraftReview";

export const metadata: Metadata = { title: "Skill Shot review" };
export const dynamic = "force-dynamic";

export default async function SkillShotReviewPage({ params }: PageProps<"/contribute/skill-shots/[id]">) {
  const { id } = await params;
  return (
    <main className="min-h-screen bg-cream text-ink">
      <SiteHeader step="Skill Shot review" />
      <DraftReview id={id} />
    </main>
  );
}
