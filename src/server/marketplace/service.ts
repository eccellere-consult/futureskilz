import "server-only";

import { and, eq, inArray, ne, sql } from "drizzle-orm";

import { familiesOf, levelOf, rolesFor, type Listing } from "@/features/marketplace/listing";
import { qualityScore } from "@/features/marketplace/quality";
import { blueprintAsset, kitAssets, skillShotAssets } from "@/features/pathway/assets";
import { confirmedSkills } from "@/features/pathway/skill-map";
import { designedSkillShots } from "@/features/skillshot";
import { reviewBlueprint } from "@/features/skillshot/rubric";
import type { Blueprint } from "@/features/skillshot/types";
import { usageByLesson } from "@/server/capture/learner-service";
import { database } from "@/server/capture/shared";
import { kcContributors, kcFeedback, kcLessons, skillShotDrafts } from "@/server/db/schema";

import { coachProfileId } from "./profile-id";

const DAY = 86_400_000;
const FIRST_PARTY = "FutureSkilz Learning Design";
const daysSince = (date: Date | string) => Math.max(0, (Date.now() - new Date(date).getTime()) / DAY);

/** How well a blueprint passes the automatic checks, as 0 to 1 (the average of the criterion scores out of 5). */
const rubricValue = (blueprint: Blueprint): number => {
  const review = reviewBlueprint(blueprint);
  return review.findings.reduce((sum, finding) => sum + finding.score, 0) / (review.findings.length * 5);
};

function designedListing(blueprint: Blueprint, updated: Date | null, reviewedByEditor: boolean): Listing {
  const asset = blueprintAsset(blueprint);
  return {
    id: asset.id, kind: "designed-skill-shot", title: asset.title, summary: asset.summary, href: asset.href, minutes: asset.minutes, level: levelOf(blueprint.meta.proficiency),
    skills: asset.skills, families: familiesOf(asset.skills), roles: rolesFor(asset.skills), industry: blueprint.meta.industry ?? "", roleLabel: blueprint.meta.role ?? "",
    creator: { name: blueprint.meta.contributorAttribution.replace(/\s*\(.*$/, "") || FIRST_PARTY, profileId: null }, learners: null,
    // A Skill Shot has no usage or ratings counted yet, so its quality rests on the checks it passed and who reviewed it.
    quality: qualityScore({ contentQuality: rubricValue(blueprint), credibility: reviewedByEditor ? 0.7 : 0.5, ageDays: updated ? daysSince(updated) : null }),
    updatedAt: (updated ?? new Date("2026-10-26")).toISOString(),
  };
}

/** Everything a learner can find: published coach lessons, designed Skill Shots, the original Skill Shots and the kits. */
export async function loadListings(): Promise<Listing[]> {
  const db = await database();
  const listings: Listing[] = [];

  // Coach lessons, with what learners have done with them.
  const lessons = await db.select({ lesson: kcLessons, publicName: kcContributors.publicName, contributorStatus: kcContributors.status }).from(kcLessons).innerJoin(kcContributors, eq(kcContributors.userId, kcLessons.contributorId)).where(and(eq(kcLessons.status, "published"), ne(kcContributors.status, "withdrawn")));
  const ids = lessons.map((row) => row.lesson.id);
  const usage = await usageByLesson(ids);
  const feedback = ids.length ? await db.select({ lessonId: kcFeedback.lessonId, total: sql<number>`count(*)`, flagged: sql<number>`sum(case when ${kcFeedback.moderation} <> 'visible' then 1 else 0 end)`, useful: sql<number>`sum(case when ${kcFeedback.useful} = 1 then 1 else 0 end)`, asked: sql<number>`sum(case when ${kcFeedback.useful} is not null then 1 else 0 end)` }).from(kcFeedback).where(inArray(kcFeedback.lessonId, ids)).groupBy(kcFeedback.lessonId) : [];
  const fb = new Map(feedback.map((row) => [row.lessonId, row]));
  const publishedPerCoach = new Map<string, number>();
  for (const row of lessons) publishedPerCoach.set(row.lesson.contributorId, (publishedPerCoach.get(row.lesson.contributorId) ?? 0) + 1);

  for (const { lesson, publicName } of lessons) {
    const spec = lesson.spec as unknown as { objective: string; roleLabel: string; industry: string; proficiency: string; skillMap?: { status: "suggested" | "confirmed"; skills: Array<{ skill: string; toLevel: number }> } };
    const skills = confirmedSkills(spec);
    const u = usage.get(lesson.id);
    const f = fb.get(lesson.id);
    const asked = Number(f?.asked ?? 0);
    listings.push({
      id: `coach-lesson:${lesson.slug}`, kind: "coach-lesson", title: lesson.title, summary: spec.objective, href: `/lessons/${lesson.slug}`, minutes: Math.max(1, Math.ceil(lesson.durationSeconds / 60)), level: levelOf(spec.proficiency),
      skills, families: familiesOf(skills), roles: rolesFor(skills), industry: spec.industry ?? "", roleLabel: spec.roleLabel ?? "", creator: { name: publicName, profileId: coachProfileId(lesson.contributorId) }, learners: u?.learners ?? 0,
      quality: qualityScore({
        usefulness: u && u.ratings > 0 ? { n: u.ratings, usefulShare: asked > 0 ? Number(f?.useful ?? 0) / asked : null, meanRating: u.meanRating } : null,
        contentQuality: (lesson.issues as unknown[] | null)?.length ? 0.6 : 0.9,
        completion: u ? { starts: u.starts, completions: u.completions } : null,
        // Approved by an editor and by the coach themselves, and a coach with more published lessons has a longer record.
        credibility: Math.min(1, 0.6 + 0.1 * ((publishedPerCoach.get(lesson.contributorId) ?? 1) - 1)),
        ageDays: daysSince(lesson.publishedAt ?? lesson.updatedAt),
        complaints: f ? { flagged: Number(f.flagged ?? 0), total: Number(f.total) } : null,
        learners: u?.learners ?? 0,
      }),
      updatedAt: (lesson.publishedAt ?? lesson.updatedAt).toISOString(),
    });
  }

  // Designed Skill Shots: those built into the product, and those an editor has published.
  const seen = new Set<string>();
  for (const blueprint of designedSkillShots) {
    seen.add(blueprint.meta.id);
    listings.push(designedListing(blueprint, null, false));
  }
  const published = await db.select().from(skillShotDrafts).where(eq(skillShotDrafts.status, "published"));
  for (const row of published) {
    const blueprint = row.blueprint as unknown as Blueprint;
    if (seen.has(blueprint.meta.id)) continue;
    seen.add(blueprint.meta.id);
    listings.push(designedListing(blueprint, row.publishedAt ?? row.updatedAt, true));
  }

  // The original Skill Shots, unless a redesigned one now sits at the same address; and the training kits.
  const firstParty = (asset: ReturnType<typeof skillShotAssets>[number]): Listing => ({
    id: asset.id, kind: asset.kind, title: asset.title, summary: asset.summary, href: asset.href, minutes: asset.minutes, level: "foundational", skills: asset.skills, families: familiesOf(asset.skills), roles: rolesFor(asset.skills),
    industry: "", roleLabel: "", creator: { name: FIRST_PARTY, profileId: null }, learners: null, quality: qualityScore({ contentQuality: 0.7, credibility: 0.5 }), updatedAt: new Date("2026-10-01").toISOString(),
  });
  for (const asset of skillShotAssets()) if (!seen.has(asset.href.replace("/skill-shots/", ""))) listings.push(firstParty(asset));
  for (const asset of kitAssets()) listings.push(firstParty(asset));
  return listings;
}
