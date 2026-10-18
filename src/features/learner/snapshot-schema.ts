import { z } from "zod";

import { pillars, type PillarId } from "../assessment/model";
import { skillFamilies, skillTaxonomy, type SkillFamilyId } from "../../domain/skills/taxonomy";

const pillarIds = pillars.map(({ id }) => id) as [PillarId, ...PillarId[]];
const familyIds = skillFamilies.map(({ id }) => id) as [SkillFamilyId, ...SkillFamilyId[]];
const skillSlugs = new Set(skillTaxonomy.map(({ slug }) => slug));

export const learnerDraftSchema = z.object({
  name: z.string().trim().max(160).default(""),
  currentRole: z.string().trim().max(160).default(""),
  responsibilityLevel: z.enum(["individual", "manager", "leader", "founder", ""]).default(""),
  focus: z.enum(["career", "leadership", "business", "ai", ""]).default(""),
  horizon: z.enum(["90-days", "6-months", "12-months", "exploring", ""]).default(""),
  priorityFamilies: z.array(z.enum(familyIds)).max(3).default([]),
  prioritySkills: z
    .array(z.string())
    .max(12)
    .default([])
    .transform((slugs) => slugs.filter((slug) => skillSlugs.has(slug))),
  challengeType: z.enum(["clarity", "decisions", "influence", "execution", "change", "technology", ""]).default(""),
  challenge: z.string().trim().max(2000).default(""),
  goal: z.string().trim().max(1000).default(""),
  weeklyMinutes: z.union([z.literal(0), z.literal(15), z.literal(30), z.literal(60), z.literal(120)]).default(0),
});

export const assessmentAnswersSchema = z.partialRecord(z.enum(pillarIds), z.number().int().min(0).max(3));

export const skillShotResultSchema = z.object({
  slug: z.string().min(1).max(190),
  practice: z.string().trim().max(4000).default(""),
  checkInAnswer: z.number().int().min(0).max(9),
  completedAt: z.string().max(40).optional(),
});

/** What the browser may hand to the server. Scores are never trusted; the server recomputes them. */
export const importableSnapshotSchema = z.object({
  draft: learnerDraftSchema,
  answers: assessmentAnswersSchema.optional(),
  skillShotResults: z.array(skillShotResultSchema).max(50).optional(),
});

export type ImportableSnapshot = z.infer<typeof importableSnapshotSchema>;
export type SkillShotResult = z.infer<typeof skillShotResultSchema>;
