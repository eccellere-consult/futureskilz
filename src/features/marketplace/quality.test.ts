import { describe, expect, it } from "vitest";

import { DEFAULT_QUALITY, qualityScore, rankScore } from "./quality";

describe("quality score", () => {
  it("is not a rating for something nobody has used: 'not yet rated', never a low score", () => {
    const r = qualityScore({ ageDays: 10 });
    expect(r).toMatchObject({ score: null, confidence: "not-rated" });
    expect(r.parts.find((p) => p.key === "freshness")!.used).toBe(true);
  });

  it("uses only signals with enough behind them, and says what each needs", () => {
    const r = qualityScore({ usefulness: { n: 3, usefulShare: 1 }, contentQuality: 0.8, completion: { starts: 2, completions: 2 } });
    expect(r.parts.find((p) => p.key === "usefulness")).toMatchObject({ used: false });
    expect(r.parts.find((p) => p.key === "usefulness")!.note).toMatch(/Needs 5 learners/);
    expect(r.parts.find((p) => p.key === "completion")!.used).toBe(false);
    expect(r.score).toBe(80);
    expect(r.confidence).toBe("early");
  });

  it("does not rest on stars alone: the weight of usefulness is capped at 30%", () => {
    const stars = qualityScore({ usefulness: { n: 50, meanRating: 5 }, contentQuality: 0.2, completion: { starts: 50, completions: 5 }, credibility: 0.2, learners: 50 });
    expect(stars.score).toBeLessThan(60);
    expect(DEFAULT_QUALITY.weights.usefulness).toBeLessThanOrEqual(30);
  });

  it("weights what is available, so a missing signal neither helps nor hurts", () => {
    const a = qualityScore({ contentQuality: 1 });
    const b = qualityScore({ contentQuality: 1, credibility: 1 });
    expect(a.score).toBe(100);
    expect(b.score).toBe(100);
  });

  it("takes a bounded amount off for complaints and ages a stale lesson", () => {
    const base = { contentQuality: 1, usefulness: { n: 40, usefulShare: 1 }, learners: 40 };
    const clean = qualityScore(base);
    const flagged = qualityScore({ ...base, complaints: { flagged: 30, total: 40 } });
    expect(clean.score! - flagged.score!).toBeGreaterThan(0);
    expect(clean.score! - flagged.score!).toBeLessThanOrEqual(DEFAULT_QUALITY.complaintPenalty);
    const fresh = qualityScore({ ...base, ageDays: 30 });
    const stale = qualityScore({ ...base, ageDays: 700 });
    expect(stale.score!).toBeLessThan(fresh.score!);
    expect(stale.confidence).toBe("established");
  });

  it("stays within 0 to 100", () => {
    expect(qualityScore({ contentQuality: 5 as number }).score).toBe(100);
    expect(qualityScore({ contentQuality: 0, complaints: { flagged: 100, total: 100 } }).score).toBe(0);
  });

  it("can be configured", () => {
    const heavy = qualityScore({ contentQuality: 0, credibility: 1 }, { ...DEFAULT_QUALITY, weights: { ...DEFAULT_QUALITY.weights, credibility: 80 } });
    const light = qualityScore({ contentQuality: 0, credibility: 1 });
    expect(heavy.score!).toBeGreaterThan(light.score!);
  });
});

describe("ordering by quality", () => {
  it("does not let one good signal on an unused lesson beat a lesson learners rated well", () => {
    const thin = qualityScore({ contentQuality: 0.95 });
    const proven = qualityScore({ usefulness: { n: 25, usefulShare: 0.9 }, contentQuality: 0.8, learners: 25 });
    expect(thin.score!).toBeGreaterThan(proven.score!);
    expect(rankScore(proven)).toBeGreaterThan(rankScore(thin));
  });
  it("sorts 'not yet rated' last without calling it bad", () => {
    expect(rankScore(qualityScore({}))).toBe(-1);
    expect(rankScore(qualityScore({ contentQuality: 0.2 }))).toBeGreaterThan(-1);
  });
});
