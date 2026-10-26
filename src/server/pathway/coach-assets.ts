import "server-only";

import { blueprintAsset, type LearningAsset } from "@/features/pathway/assets";
import { confirmedSkills } from "@/features/pathway/skill-map";
import { listPublishedLessons } from "@/server/capture/lesson-service";
import { listPublishedBlueprints } from "@/server/skillshots/service";

/** Published coach lessons whose skills an editor confirmed, as pathway assets. Unconfirmed lessons stay out of learners' pathways. */
export async function coachLessonAssets(): Promise<LearningAsset[]> {
  const [lessons, designed] = await Promise.all([listPublishedLessons(), listPublishedBlueprints().catch(() => [])]);
  return [...designed.filter((blueprint) => blueprint.meta.skillMap.length > 0).map(blueprintAsset), ...lessons.flatMap(({ slug, title, spec }) => {
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
  })];
}
