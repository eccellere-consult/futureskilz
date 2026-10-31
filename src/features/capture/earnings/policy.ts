import { z } from "zod";

/**
 * A revenue-share policy is configuration, not code. The platform has not approved a formula, so nothing here supplies one:
 * every number below is chosen and approved by the business (with legal and tax advice) before a statement can be payable.
 * A policy that is not approved can still be used to preview ("illustrative") how a statement would read.
 *
 * Money is whole minor units (paise, cents). Shares are whole basis points (1% = 100).
 */

export const WEIGHT_KEYS = ["consumption", "completion", "materialUse", "usefulness"] as const;
export type WeightKey = (typeof WEIGHT_KEYS)[number];

/** Ratings can modulate an allocation but never carry it: usefulness may not exceed 30% of the weights. */
export const MAX_USEFULNESS_WEIGHT_BP = 3000;

export const revenuePolicySchema = z
  .object({
    version: z.string().min(3).max(40),
    currency: z.string().length(3).transform((value) => value.toUpperCase()),
    /** Which receipts count, and what is taken off first. */
    receiptBasis: z.enum(["gross", "net_of_refunds", "net_of_refunds_fees_tax"]),
    /** Share of eligible receipts that goes to the contributor pool. */
    contributorPoolBp: z.number().int().min(0).max(10000),
    weights: z.object({
      consumption: z.number().int().min(0).max(10000),
      completion: z.number().int().min(0).max(10000),
      materialUse: z.number().int().min(0).max(10000),
      usefulness: z.number().int().min(0).max(10000),
    }),
    consumption: z.object({ capSecondsPerLearnerLessonDay: z.number().int().min(60).max(86400) }),
    usefulness: z.object({
      minRatings: z.number().int().min(1).max(1000),
      /** Pulls a lesson with few ratings toward the prior so one rating cannot swing an allocation. */
      priorWeight: z.number().int().min(0).max(1000),
      priorMean: z.number().min(1).max(5),
    }),
    antiGaming: z.object({
      /** Repeat events beyond this per learner, lesson and day are recorded but not counted. */
      maxCountedEventsPerLearnerLessonDay: z.number().int().min(1).max(50),
    }),
    payout: z.object({
      minPayoutMinor: z.number().int().min(0),
      holdDays: z.number().int().min(0).max(365),
      frequency: z.enum(["monthly", "quarterly"]),
      disputeWindowDays: z.number().int().min(0).max(365),
    }),
    /**
     * Which formula sizes each lesson's share of the pool. "weighted_pool" adds four measures by weight; "qvs" is the Qualified
     * Value Score: a product of usage, depth, usefulness, quality, outcome, freshness and trust, so a lesson must be good on every
     * measure to earn well. The business decides which governs; both run on the same data, so they can be compared first.
     */
    formula: z.enum(["weighted_pool", "qvs"]).default("weighted_pool"),
    qvs: z.object({ freshnessHalfLifeDays: z.number().int().min(30).max(1825).default(365) }).default({ freshnessHalfLifeDays: 365 }),
    multiContributor: z.literal("by_lesson_attribution"),
    notes: z.string().max(2000).optional(),
  })
  .superRefine((policy, ctx) => {
    const total = WEIGHT_KEYS.reduce((sum, key) => sum + policy.weights[key], 0);
    if (total !== 10000) ctx.addIssue({ code: "custom", path: ["weights"], message: `Weights must add up to 10000 basis points (100%); they add up to ${total}.` });
    if (policy.weights.usefulness > MAX_USEFULNESS_WEIGHT_BP)
      ctx.addIssue({ code: "custom", path: ["weights", "usefulness"], message: "Learner ratings may carry at most 30% of the weight, so ratings alone cannot decide earnings." });
  });

export type RevenuePolicy = z.infer<typeof revenuePolicySchema>;

/** A starting point for the business to edit. It is labelled draft and is never approved automatically. */
export function draftPolicyTemplate(): RevenuePolicy {
  return {
    version: "draft-0.1",
    currency: "INR",
    receiptBasis: "net_of_refunds_fees_tax",
    contributorPoolBp: 0,
    weights: { consumption: 3500, completion: 2500, materialUse: 2000, usefulness: 2000 },
    consumption: { capSecondsPerLearnerLessonDay: 1800 },
    usefulness: { minRatings: 5, priorWeight: 3, priorMean: 3 },
    antiGaming: { maxCountedEventsPerLearnerLessonDay: 3 },
    payout: { minPayoutMinor: 0, holdDays: 30, frequency: "monthly", disputeWindowDays: 30 },
    formula: "weighted_pool",
    qvs: { freshnessHalfLifeDays: 365 },
    multiContributor: "by_lesson_attribution",
    notes: "Template only. The contributor pool share is zero until the business sets it. Weights are illustrative.",
  };
}
