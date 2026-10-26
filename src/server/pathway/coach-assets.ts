import "server-only";

import type { LearningAsset } from "@/features/pathway/assets";
import { confirmedSkills } from "@/features/pathway/skill-map";
import { listPublishedLessons } from "@/server/capture/lesson-service";

/** Published coach lessons whose skills an editor confirmed, as pathway assets. Unconfirmed lessons stay out of learners' pathways. */
export async function coachLessonAssets(): Promise<LearningAsset[]> {
  const lessons = await listPublishedLessons();
  return lessons.flatMap(({ slug, title, spec }) => {
    const skills = confirmedSkills(spec);
    if (skills.length === 0) return [];
    return [{
      id: `coach-lesson:${slug}`,
      kind: "coach-lesson" as const,
      title,
      summary: spec.objective,
      href: `/lessons/${slug}`,
      minutes: Math.max(1, Math.ceil(spec.durationSeconds / 60)),
      skills,
      practice: spec.check?.prompt || "Apply the lesson to a real situation from your work.",
      attribution: spec.attribution,
    }];
  });
}
