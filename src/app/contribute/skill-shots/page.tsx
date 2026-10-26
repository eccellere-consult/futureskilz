import type { Metadata } from "next";

import { SiteHeader } from "@/components/site-header";
import { SkillShotStudio } from "@/features/skillshot/studio/SkillShotStudio";

export const metadata: Metadata = { title: "Skill Shot studio" };
export const dynamic = "force-dynamic";

export default function SkillShotStudioPage() {
  return (
    <main className="min-h-screen bg-cream text-ink">
      <SiteHeader step="Skill Shot studio" />
      <SkillShotStudio />
    </main>
  );
}
