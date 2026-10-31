import { describe, expect, it } from "vitest";

import { detectFraud, lessonTrust, type FraudEvent } from "./fraud";
import { coachReputation } from "./reputation";

const ev = (learnerRef: string, lessonId: string, type: FraudEvent["type"], seconds = 0, at = "2026-10-10T09:00:00.000Z"): FraudEvent => ({ learnerRef, lessonId, type, seconds, occurredAt: at });
const lessons = [{ id: "L1", durationSeconds: 600, authorLearnerRefs: ["author"] }, { id: "L2", durationSeconds: 600, authorLearnerRefs: [] }, { id: "L3", durationSeconds: 600, authorLearnerRefs: [] }, { id: "L4", durationSeconds: 600, authorLearnerRefs: [] }];

describe("fraud rules", () => {
  it("flags an author completing their own lesson, once", () => {
    const flags = detectFraud({ events: [ev("author", "L1", "complete"), ev("author", "L1", "complete")], ratings: [], lessons });
    expect(flags.filter((f) => f.rule === "self_use")).toHaveLength(1);
  });
  it("flags a learner who finishes three lessons in under a quarter of their length, not two", () => {
    const quick = (ids: string[]) => ids.flatMap((id) => [ev("fast", id, "progress", 60), ev("fast", id, "complete")]);
    expect(detectFraud({ events: quick(["L1", "L2"]), ratings: [], lessons }).some((f) => f.rule === "speed_completion")).toBe(false);
    expect(detectFraud({ events: quick(["L1", "L2", "L3"]), ratings: [], lessons }).some((f) => f.rule === "speed_completion")).toBe(true);
  });
  it("flags eight completions within half an hour as high", () => {
    const events = Array.from({ length: 8 }, (_, i) => ev("burst", `L${(i % 4) + 1}`, "complete", 0, `2026-10-10T09:0${i}:00.000Z`));
    const flag = detectFraud({ events, ratings: [], lessons }).find((f) => f.rule === "completion_burst");
    expect(flag?.severity).toBe("high");
  });
  it("flags ratings from people who never finished, and a burst of high ratings", () => {
    const ratings = Array.from({ length: 8 }, (_, i) => ({ lessonId: "L2", learnerRef: `r${i}`, rating: 5, occurredAt: `2026-10-10T09:0${i}:00.000Z` }));
    const rules = detectFraud({ events: [], ratings, lessons }).map((f) => f.rule);
    expect(rules).toContain("ratings_without_completion");
    expect(rules).toContain("rating_burst");
  });
  it("raises nothing for ordinary activity", () => {
    const events = [ev("a", "L2", "start"), ev("a", "L2", "progress", 580), ev("a", "L2", "complete")];
    expect(detectFraud({ events, ratings: [{ lessonId: "L2", learnerRef: "a", rating: 4, occurredAt: "2026-10-11T09:00:00.000Z" }], lessons })).toEqual([]);
  });
  it("flags a refund spike across enough receipts", () => {
    const receipts = Array.from({ length: 5 }, (_, i) => ({ externalRef: `r${i}`, grossMinor: 1000, refundMinor: 600, receivedAt: "2026-10-10T00:00:00.000Z" }));
    expect(detectFraud({ events: [], ratings: [], lessons, receipts }).some((f) => f.rule === "refund_spike")).toBe(true);
  });
});

describe("lesson trust", () => {
  it("drops while flags are open, sharply when confirmed, and ignores dismissed ones", () => {
    expect(lessonTrust([])).toBe(1);
    expect(lessonTrust([{ status: "dismissed", severity: "high" }])).toBe(1);
    expect(lessonTrust([{ status: "open", severity: "medium" }])).toBeCloseTo(0.7);
    expect(lessonTrust([{ status: "confirmed", severity: "low" }])).toBeCloseTo(0.2);
    expect(lessonTrust(Array.from({ length: 6 }, () => ({ status: "confirmed" as const, severity: "high" as const })))).toBeGreaterThanOrEqual(0.05);
  });
});

describe("coach reputation", () => {
  const base = { lessonsPublished: 4, learners: 40, starts: 40, completions: 32, ratings: 20, meanRating: 4.5, contentQuality: 0.9, tenureDays: 200, flagsConfirmed: 0, flagsOpen: 0 };
  it("says not yet rated when there is little behind it", () => {
    expect(coachReputation({ ...base, lessonsPublished: 1, learners: 1, starts: 1, completions: 0, ratings: 0, meanRating: null, contentQuality: null, tenureDays: 5 }).score).toBeNull();
  });
  it("is high for strong evidence and lower after confirmed fraud", () => {
    const good = coachReputation(base);
    expect(good.score).toBeGreaterThan(75);
    expect(coachReputation({ ...base, flagsConfirmed: 1 }).score!).toBeLessThan(good.score! - 20);
  });
  it("does not let ratings alone make a score", () => {
    const stars = coachReputation({ ...base, lessonsPublished: 0, starts: 0, completions: 0, learners: 2, contentQuality: null });
    expect(stars.score).toBeNull();
  });
});
