import { describe, expect, it } from "vitest";

import { ratingLabel, summariseRatings } from "./rating";

describe("star ratings", () => {
  it("gives no average until someone has rated", () => {
    expect(summariseRatings(0, 0)).toEqual({ count: 0, average: null });
    expect(ratingLabel(summariseRatings(0, 0))).toBeNull();
    expect(ratingLabel(null)).toBeNull();
  });
  it("rounds the average to one decimal place and always says how many rated", () => {
    expect(summariseRatings(3, 13)).toEqual({ count: 3, average: 4.3 });
    expect(ratingLabel(summariseRatings(3, 13))).toBe("4.3 out of 5 from 3 ratings");
    expect(ratingLabel(summariseRatings(1, 5))).toBe("5.0 out of 5 from 1 rating");
  });
  it("is not thrown by a bad count from the database", () => {
    expect(summariseRatings(Number.NaN, 4)).toEqual({ count: 0, average: null });
    expect(summariseRatings(-2, 4)).toEqual({ count: 0, average: null });
  });
});
