import { describe, expect, it } from "vitest";

import { role } from "./fixtures";
import { buildTimeline, roleCandidatesFromText } from "./timeline";

describe("career walk-through", () => {
  it("finds jobs, employers, titles and years, keeping approximate dates approximate", () => {
    const text = [
      "I joined as a Graduate Trainee at Tata Steel, 1996-1999.",
      "Then Planning Manager at Acme Steel (2000-2006).",
      "Later I worked as Plant Head with Bharat Forge from about 2007 to present.",
    ].join("\n");
    const found = roleCandidatesFromText(text);
    expect(found).toHaveLength(3);
    expect(found[0]).toMatchObject({ title: "Graduate Trainee", company: "Tata Steel", startYear: 1996, endYear: 1999 });
    expect(found[1].title).toBe("Planning Manager");
    expect(found[2]).toMatchObject({ title: "Plant Head", company: "Bharat Forge", startYear: 2007, ongoing: true, datesApproximate: true });
    expect(found.every((c) => c.quote.length > 0)).toBe(true);
  });

  it("returns nothing it cannot support", () => {
    expect(roleCandidatesFromText("I worked in many places and learned a lot.")).toEqual([]);
  });
});

describe("timeline checks", () => {
  const now = new Date("2026-10-25T00:00:00Z");
  it("flags overlaps, gaps, missing dates and impossible dates", () => {
    const roles = [
      role({ id: "a", startYear: 1996, endYear: 2004 }),
      role({ id: "b", title: "Manager", startYear: 2001, endYear: 2008 }),
      role({ id: "c", title: "Director", startYear: 2013, endYear: 2012 }),
      role({ id: "d", company: "", startYear: null, endYear: null }),
    ];
    const kinds = buildTimeline(roles, now).flags.map((f) => f.severity);
    expect(kinds).toContain("overlap");
    expect(kinds).toContain("conflict");
    expect(kinds).toContain("vague");
  });

  it("reports a gap and the covered span for a clean career", () => {
    const timeline = buildTimeline([role({ id: "a", startYear: 1996, endYear: 2000 }), role({ id: "b", startYear: 2005, endYear: 2012 })], now);
    expect(timeline.flags.map((f) => f.severity)).toEqual(["gap"]);
    expect(timeline.span).toEqual({ from: 1996, to: 2012 });
  });
});
