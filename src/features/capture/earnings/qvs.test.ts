import { describe, expect, it } from "vitest";

import { calculateAllocations, type LearningEvent, type LessonInfo, type Rating, type Receipt } from "./calculator";
import { draftPolicyTemplate, revenuePolicySchema, type RevenuePolicy } from "./policy";

const period = { start: "2026-10-01T00:00:00.000Z", end: "2026-11-01T00:00:00.000Z" };
const policy = (patch: Partial<RevenuePolicy> = {}): RevenuePolicy => ({ ...draftPolicyTemplate(), version: "2026.q", contributorPoolBp: 5000, formula: "qvs", ...patch });
const receipts: Receipt[] = [{ id: "r", grossMinor: 1_000_000, refundMinor: 0, feeMinor: 0, taxMinor: 0, currency: "INR", receivedAt: "2026-10-10T00:00:00.000Z", status: "eligible" }];
let n = 0;
const ev = (lessonId: string, learnerRef: string, type: LearningEvent["type"], seconds = 0, value: number | null = null): LearningEvent => ({ id: `e${++n}`, lessonId, learnerRef, type, seconds, value, occurredAt: "2026-10-10T09:00:00.000Z" });
const attr = (id: string): LessonInfo => ({ id, title: id, version: 1, attribution: [{ contributorId: `c-${id}`, shareBp: 10000 }] });

const learners = (lesson: string, count: number, opts: { finish?: boolean; seconds?: number } = {}) =>
  Array.from({ length: count }, (_, i) => [ev(lesson, `${lesson}-${i}`, "start"), ev(lesson, `${lesson}-${i}`, "progress", opts.seconds ?? 600), ...(opts.finish === false ? [] : [ev(lesson, `${lesson}-${i}`, "complete")])]).flat();

describe("Qualified Value Score", () => {
  it("defaults existing policies to the weighted pool", () => {
    const { formula, qvs, ...old } = policy();
    void formula; void qvs;
    const parsed = revenuePolicySchema.parse(old);
    expect(parsed.formula).toBe("weighted_pool");
    expect(parsed.qvs.freshnessHalfLifeDays).toBe(365);
  });

  it("splits the pool exactly and reports the seven factors", () => {
    const run = calculateAllocations({ policy: policy(), policyApproved: true, period, receipts, events: [...learners("A", 6), ...learners("B", 3)], ratings: [], lessons: [attr("A"), attr("B")] });
    expect(run.lessons.every((row) => row.qvs)).toBe(true);
    expect(run.lessons.reduce((s, r) => s + r.allocationMinor, 0) + run.unallocatedMinor).toBe(run.inputs.poolMinor);
    expect(run.lessons[0].allocationMinor).toBeGreaterThan(run.lessons[1].allocationMinor);
  });

  it("lets one weak factor pull a lesson down: a reached but unfinished lesson earns less than a finished one", () => {
    const run = calculateAllocations({ policy: policy(), policyApproved: true, period, receipts, events: [...learners("A", 5), ...learners("B", 5, { finish: false })], ratings: [], lessons: [attr("A"), attr("B")] });
    expect(run.lessons[0].allocationMinor).toBeGreaterThan(run.lessons[1].allocationMinor);
  });

  it("pays an older lesson less than a fresh one, and a lesson under fraud review less than a trusted one", () => {
    const events = [...learners("A", 5), ...learners("B", 5), ...learners("C", 5)];
    const run = calculateAllocations({ policy: policy(), policyApproved: true, period, receipts, events, ratings: [], lessons: [{ ...attr("A"), ageDays: 0 }, { ...attr("B"), ageDays: 730 }, { ...attr("C"), trust: 0.3 }] });
    const [a, b, c] = run.lessons.map((row) => row.allocationMinor);
    expect(a).toBeGreaterThan(b);
    expect(a).toBeGreaterThan(c);
  });

  it("counts nothing from learners confirmed as fraud", () => {
    const events = [...learners("A", 4), ...learners("B", 4)];
    const run = calculateAllocations({ policy: policy(), policyApproved: true, period, receipts, events, ratings: [], lessons: [attr("A"), attr("B")], excludedLearners: ["B-0", "B-1", "B-2", "B-3"] });
    expect(run.lessons[1].allocationMinor).toBe(0);
    expect(run.lessons[0].allocationMinor).toBe(run.inputs.poolMinor);
  });

  it("does not let ratings alone earn anything", () => {
    const ratings: Rating[] = Array.from({ length: 10 }, (_, i) => ({ lessonId: "A", learnerRef: `r${i}`, rating: 5, occurredAt: "2026-10-12T00:00:00.000Z" }));
    const run = calculateAllocations({ policy: policy(), policyApproved: true, period, receipts, events: [], ratings, lessons: [attr("A")] });
    expect(run.lessons[0].allocationMinor).toBe(0);
  });
});
