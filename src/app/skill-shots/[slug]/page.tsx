import { notFound } from "next/navigation";

import { SiteHeader } from "@/components/site-header";
import { getSkillShot, skillShots } from "@/features/journey/model";
import { SkillShotExperience } from "@/features/journey/skill-shot-experience";

export function generateStaticParams() {
  return skillShots.map((skillShot) => ({ slug: skillShot.slug }));
}

export default async function SkillShotPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const skillShot = getSkillShot(slug);

  if (!skillShot) notFound();

  return (
    <main className="min-h-screen bg-cream text-ink">
      <SiteHeader step="Practise · 05" />
      <SkillShotExperience skillShot={skillShot} />
    </main>
  );
}