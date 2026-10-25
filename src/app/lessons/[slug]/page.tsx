import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SiteHeader } from "@/components/site-header";
import { LessonPlayer } from "@/features/capture/ui/LessonPlayer";
import { getPublishedLesson } from "@/server/capture/lesson-service";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/lessons/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const lesson = await getPublishedLesson(slug).catch(() => null);
  return lesson ? { title: lesson.title, description: lesson.spec.objective } : { title: "Lesson" };
}

export default async function LessonPage({ params }: PageProps<"/lessons/[slug]">) {
  const { slug } = await params;
  const lesson = await getPublishedLesson(slug).catch(() => null);
  if (!lesson) notFound();
  return (
    <main className="min-h-screen bg-cream text-ink">
      <SiteHeader step="Lesson" />
      <div className="mx-auto w-full max-w-4xl px-5 pt-6 sm:px-8"><Link className="text-sm text-teal underline underline-offset-4" href="/lessons">All lessons</Link></div>
      <LessonPlayer credits={lesson.credits} slug={lesson.slug} spec={lesson.spec} />
    </main>
  );
}
