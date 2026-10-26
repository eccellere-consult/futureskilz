import { describe, expect, it } from "vitest";

import { estimateEarnings, shareSensitivity } from "./estimate";

const base = { learnersPerMonth: 1000, netPerLearnerMinor: 50_000, poolBp: 4000, shareBp: 500 };

describe("coach earnings what-if", () => {
  it("takes the pool from net revenue and then the coach's part of all learning, in whole paise", () => {
    const result = estimateEarnings(base);
    expect(result.monthlyNetMinor).toBe(50_000_000);
    expect(result.monthlyPoolMinor).toBe(20_000_000);
    expect(result.monthlyYoursMinor).toBe(1_000_000);
    expect(result.yearlyYoursMinor).toBe(12_000_000);
  });

  it("gives nothing when the pool is zero, as the draft policy does until the business sets it", () => {
    expect(estimateEarnings({ ...base, poolBp: 0 }).monthlyYoursMinor).toBe(0);
  });

  it("never rounds up and never goes negative or beyond the whole", () => {
    expect(estimateEarnings({ learnersPerMonth: 3, netPerLearnerMinor: 33, poolBp: 3333, shareBp: 3333 }).monthlyYoursMinor).toBe(10);
    expect(estimateEarnings({ ...base, learnersPerMonth: -5, shareBp: 99_999 }).monthlyYoursMinor).toBe(0);
    expect(estimateEarnings({ ...base, shareBp: 99_999 }).monthlyYoursMinor).toBe(estimateEarnings({ ...base, shareBp: 10_000 }).monthlyYoursMinor);
    expect(estimateEarnings({ ...base, learnersPerMonth: Number.NaN }).monthlyNetMinor).toBe(0);
  });

  it("shows how the result moves with how much of the learning is theirs", () => {
    const rows = shareSensitivity(base, [100, 500, 1000]);
    expect(rows.map((row) => row.monthlyYoursMinor)).toEqual([200_000, 1_000_000, 2_000_000]);
  });
});
