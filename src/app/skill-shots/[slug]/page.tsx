import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SiteHeader } from "@/components/site-header";
import { getSkillShot, skillShots } from "@/features/journey/model";
import { SkillShotExperience } from "@/features/journey/skill-shot-experience";
import { designedSkillShots } from "@/features/skillshot";
import { findDesigned } from "@/server/skillshots/designed";
import { DesignedSkillShotPlayer } from "@/features/skillshot/DesignedSkillShotPlayer";

export function generateStaticParams() {
  return [...skillShots.map((skillShot) => skillShot.slug), ...designedSkillShots.map((item) => item.meta.id)].map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const designed = await findDesigned(slug);
  return designed ? { title: designed.meta.title, description: designed.design.learningObjective } : {};
}

export default async function SkillShotPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const designed = await findDesigned(slug);
  const skillShot = designed ? undefined : getSkillShot(slug);

  if (!designed && !skillShot) notFound();

  return (
    <main className="min-h-screen bg-cream text-ink">
      <SiteHeader step="Practise · 05" />
      {designed ? <DesignedSkillShotPlayer blueprint={designed} /> : <SkillShotExperience skillShot={skillShot!} />}
    </main>
  );
}
