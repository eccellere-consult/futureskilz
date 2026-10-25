import { describe, expect, it } from "vitest";

import { calculateAllocations, canonicalJson, countEvents, splitWhole, type LearningEvent, type LessonInfo, type Rating, type Receipt } from "./calculator";
import { draftPolicyTemplate, revenuePolicySchema, type RevenuePolicy } from "./policy";

const period = { start: "2026-10-01T00:00:00.000Z", end: "2026-11-01T00:00:00.000Z" };
const policy = (patch: Partial<RevenuePolicy> = {}): RevenuePolicy => ({ ...draftPolicyTemplate(), version: "2026.1", contributorPoolBp: 4000, ...patch });
const receipt = (patch: Partial<Receipt> = {}): Receipt => ({ id: "r1", grossMinor: 1_000_000, refundMinor: 0, feeMinor: 0, taxMinor: 0, currency: "INR", receivedAt: "2026-10-10T00:00:00.000Z", status: "eligible", ...patch });
const lessons: LessonInfo[] = [
  { id: "L1", title: "Scheduling", version: 1, attribution: [{ contributorId: "asha", shareBp: 10000 }] },
  { id: "L2", title: "Scorecard", version: 1, attribution: [{ contributorId: "asha", shareBp: 6000 }, { contributorId: "ravi", shareBp: 4000 }] },
];
let id = 0;
const ev = (lessonId: string, learnerRef: string, type: LearningEvent["type"], seconds = 0, day = "10"): LearningEvent => ({ id: `e${++id}`, lessonId, learnerRef, type, seconds, occurredAt: `2026-10-${day}T09:00:00.000Z` });
const rating = (lessonId: string, learnerRef: string, value: number): Rating => ({ lessonId, learnerRef, rating: value, occurredAt: "2026-10-12T00:00:00.000Z" });

describe("policy", () => {
  it("accepts a valid policy and rejects weights that do not add up", () => {
    expect(revenuePolicySchema.safeParse(policy()).success).toBe(true);
    const bad = revenuePolicySchema.safeParse({ ...policy(), weights: { consumption: 5000, completion: 2500, materialUse: 2000, usefulness: 2000 } });
    expect(bad.success).toBe(false);
    expect(bad.error?.issues[0].message).toMatch(/10000/);
  });

  it("does not let ratings carry more than 30% of the weight", () => {
    const result = revenuePolicySchema.safeParse({ ...policy(), weights: { consumption: 1000, completion: 1000, materialUse: 1000, usefulness: 7000 } });
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toMatch(/ratings alone/);
  });

  it("ships a template that pays nothing until the business sets the pool", () => {
    expect(draftPolicyTemplate().contributorPoolBp).toBe(0);
  });
});

describe("splitWhole", () => {
  it("adds up exactly and rounds by largest remainder", () => {
    expect(splitWhole(100, [1, 1, 1])).toEqual([34, 33, 33]);
    expect(splitWhole(10, [0, 0])).toEqual([0, 0]);
    const parts = splitWhole(1_000_003, [3333, 3333, 3334]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(1_000_003);
  });
});

describe("event counting", () => {
  it("caps repeated events and daily engagement, and ignores duplicates and events outside the period", () => {
    const p = policy();
    const events = [
      ev("L1", "a", "progress", 1500), ev("L1", "a", "progress", 1500), ev("L1", "a", "progress", 1500), ev("L1", "a", "progress", 1500),
      { ...ev("L1", "a", "progress", 60), id: "dup" }, { ...ev("L1", "a", "progress", 60), id: "dup" },
      { ...ev("L1", "a", "start"), occurredAt: "2026-09-30T23:00:00.000Z" },
    ];
    const { events: counted, notCounted } = countEvents(events, p, period.start, period.end);
    const seconds = counted.filter((e) => e.type === "progress").reduce((s, e) => s + e.seconds, 0);
    expect(seconds).toBeLessThanOrEqual(p.consumption.capSecondsPerLearnerLessonDay);
    expect(notCounted).toBeGreaterThan(0);
  });

  it("always counts a completion, even after the daily cap", () => {
    const p = policy({ antiGaming: { maxCountedEventsPerLearnerLessonDay: 1 } });
    const { events } = countEvents([ev("L1", "a", "start"), ev("L1", "a", "progress", 100), ev("L1", "a", "complete")], p, period.start, period.end);
    expect(events.some((e) => e.type === "complete")).toBe(true);
  });
});

describe("allocation", () => {
  const run = (patch: Partial<Parameters<typeof calculateAllocations>[0]> = {}) =>
    calculateAllocations({ policy: policy(), policyApproved: true, period, receipts: [receipt()], events: [], ratings: [], lessons, ...patch });

  const activity: LearningEvent[] = [
    ev("L1", "a", "progress", 600), ev("L1", "a", "complete"), ev("L1", "b", "progress", 600), ev("L1", "b", "complete"), ev("L1", "b", "material_use"),
    ev("L2", "c", "progress", 600), ev("L2", "c", "complete"),
  ];

  it("shares the pool in proportion to counted use, exactly, and splits multi-contributor lessons by attribution", () => {
    const result = run({ events: activity });
    expect(result.inputs.poolMinor).toBe(400_000);
    const total = result.lessons.reduce((s, l) => s + l.allocationMinor, 0);
    expect(total + result.unallocatedMinor).toBe(400_000);
    expect(result.lessons[0].allocationMinor).toBeGreaterThan(result.lessons[1].allocationMinor);
    const asha = result.contributors.find((c) => c.contributorId === "asha")!;
    const ravi = result.contributors.find((c) => c.contributorId === "ravi")!;
    expect(asha.totalMinor + ravi.totalMinor).toBe(total);
    const l2 = result.lessons[1].allocationMinor;
    expect(ravi.lines[0].amountMinor).toBe(Math.round(l2 * 0.4));
    expect(asha.payable).toBe(true);
  });

  it("marks a statement illustrative and not payable when the policy is not approved", () => {
    const result = run({ events: activity, policyApproved: false });
    expect(result.status).toBe("illustrative");
    expect(result.contributors.every((c) => !c.payable)).toBe(true);
    expect(result.notes.join(" ")).toMatch(/Illustrative/);
  });

  it("allocates nothing when the policy sets no pool", () => {
    const result = run({ events: activity, policy: policy({ contributorPoolBp: 0 }) });
    expect(result.contributors.every((c) => c.totalMinor === 0)).toBe(true);
  });

  it("never lets ratings create earnings: no completions, no usefulness points", () => {
    const ratings = Array.from({ length: 10 }, (_, i) => rating("L2", `x${i}`, 5));
    const result = run({ events: [ev("L1", "a", "progress", 600), ev("L1", "a", "complete")], ratings });
    expect(result.lessons.find((l) => l.lessonId === "L2")!.allocationMinor).toBe(0);
    expect(result.lessons.find((l) => l.lessonId === "L2")!.usefulnessPoints).toBe(0);
  });

  it("ignores ratings below the policy's minimum count and counts one rating per learner", () => {
    const few = run({ events: activity, ratings: [rating("L1", "a", 5), rating("L1", "b", 5)] });
    expect(few.lessons[0].usefulnessPoints).toBe(0);
    const repeat = run({ events: activity, ratings: Array.from({ length: 10 }, () => rating("L1", "a", 5)) });
    expect(repeat.lessons[0].ratings).toBe(1);
  });

  it("rewards a well-rated lesson only among lessons people finished", () => {
    const events = [...activity];
    const other = Array.from({ length: 6 }, (_, i) => rating("L2", `o${i}`, 4));
    const happy = Array.from({ length: 6 }, (_, i) => rating("L1", `r${i}`, 5));
    const unhappy = Array.from({ length: 6 }, (_, i) => rating("L1", `u${i}`, 1));
    const good = run({ events, ratings: [...other, ...happy] }).lessons[0].allocationMinor;
    const bad = run({ events, ratings: [...other, ...unhappy] }).lessons[0].allocationMinor;
    expect(good).toBeGreaterThan(bad);
  });

  it("moves the weight of a measure nobody triggered onto the others", () => {
    const result = run({ events: [ev("L1", "a", "complete")] });
    expect(result.appliedWeights.completion).toBe(1);
    expect(result.appliedWeights.consumption).toBe(0);
    expect(result.notes.join(" ")).toMatch(/no activity/);
  });

  it("leaves the pool unallocated when nothing was used, and says so", () => {
    const result = run();
    expect(result.unallocatedMinor).toBe(400_000);
    expect(result.notes.join(" ")).toMatch(/No learning activity/);
  });

  it("applies the receipt basis and excludes held, refunded, disputed and other-currency receipts", () => {
    const receipts = [receipt({ grossMinor: 100_000, refundMinor: 10_000, feeMinor: 5_000, taxMinor: 15_000 }), receipt({ id: "r2", status: "held" }), receipt({ id: "r3", currency: "USD" }), receipt({ id: "r4", receivedAt: "2026-09-01T00:00:00.000Z" })];
    expect(run({ receipts }).inputs.eligibleNetMinor).toBe(70_000);
    expect(run({ receipts, policy: policy({ receiptBasis: "gross" }) }).inputs.eligibleNetMinor).toBe(100_000);
    expect(run({ receipts, policy: policy({ receiptBasis: "net_of_refunds" }) }).inputs.eligibleNetMinor).toBe(90_000);
    expect(run({ receipts }).inputs.receiptsExcluded).toBe(3);
  });

  it("withholds payment below the minimum payout and sets the earliest payment date after the hold", () => {
    const result = run({ events: activity, policy: policy({ payout: { minPayoutMinor: 10_000_000, holdDays: 30, frequency: "monthly", disputeWindowDays: 30 } }) });
    expect(result.contributors.every((c) => !c.payable)).toBe(true);
    expect(result.payableAfter).toBe("2026-12-01T00:00:00.000Z");
  });

  it("is deterministic: the same inputs give the same fingerprint", () => {
    const a = canonicalJson(run({ events: activity }));
    const b = canonicalJson(run({ events: [...activity].reverse() }));
    expect(a).toBe(b);
  });
});
