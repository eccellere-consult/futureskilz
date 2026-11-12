import { describe, expect, it } from "vitest";

import { batchByChars, fitToBudget } from "./budget";
import { isTooCopied, publishedWorkMarkers, publishedWorkRefusal, screenHarmfulAdvice, verbatimOverlap } from "./rights";

const page = "The supplier audit starts with a review of the incoming inspection records for the previous quarter and then moves to the shop floor where the auditor checks calibration stickers on every gauge in use and compares the control plan with what operators actually do at each station during a normal shift";

describe("verbatimOverlap", () => {
  it("blocks a copied page", () => {
    const result = verbatimOverlap(page, [page]);
    expect(isTooCopied(result)).toBe(true);
    expect(result.hits[0].words).toBeGreaterThan(15);
  });
  it("lets a paraphrase through", () => {
    const own = "When you audit a supplier, begin with last quarter's goods-in checks, then walk the line and confirm every gauge is calibrated and that operators follow the written control plan.";
    expect(isTooCopied(verbatimOverlap(own, [page]))).toBe(false);
  });
  it("ignores short drafts and empty sources", () => {
    expect(verbatimOverlap("too short", [page]).ratio).toBe(0);
    expect(isTooCopied(verbatimOverlap(page, []))).toBe(false);
  });
});

describe("screenHarmfulAdvice", () => {
  it("flags clearly harmful advice", () => {
    expect(screenHarmfulAdvice("Just bypass the safety interlock to save time.").map((h) => h.id)).toContain("bypass_safety");
    expect(screenHarmfulAdvice("Take 500 mg twice a day.").map((h) => h.id)).toContain("medical_dose");
    expect(screenHarmfulAdvice("A guaranteed return of 20%.").map((h) => h.id)).toContain("guaranteed_returns");
  });
  it("passes ordinary teaching text", () => {
    expect(screenHarmfulAdvice("Check the interlock works before each shift and record the result.")).toEqual([]);
  });
});

describe("fitToBudget", () => {
  it("keeps short text whole", () => {
    expect(fitToBudget("short", 100)).toMatchObject({ droppedChars: 0, note: null });
  });
  it("reports what it dropped", () => {
    const r = fitToBudget("One sentence here. ".repeat(20), 100);
    expect(r.droppedChars).toBeGreaterThan(0);
    expect(r.usedChars + r.droppedChars).toBeGreaterThanOrEqual(r.totalChars - 1);
    expect(r.note).toMatch(/left out/);
  });
});

describe("batchByChars", () => {
  it("batches and caps visibly", () => {
    const r = batchByChars(Array.from({ length: 10 }, () => "x".repeat(10)), (s) => s.length, 25, 2);
    expect(r.batches).toHaveLength(2);
    expect(r.readCount).toBe(4);
    expect(r.total).toBe(10);
  });
});

describe("published-work marks", () => {
  const bookPage = `Chapter 3. The Planning Habit\n\n${page}\n\n© 2019 Harbor Lane Press. All rights reserved. ISBN 978-1-4028-9462-6.\nNo part of this publication may be reproduced, stored or transmitted in any form.`;
  it("finds the notices on a copied book page", () => {
    expect(publishedWorkMarkers(bookPage).length).toBeGreaterThanOrEqual(3);
  });
  it("refuses it as your own, and says what to do instead", () => {
    const refusal = publishedWorkRefusal("mine", bookPage);
    expect(refusal).toMatch(/published work/);
    expect(refusal).toMatch(/shared with my permission/);
  });
  it("accepts a stated permission, and ordinary text as your own", () => {
    expect(publishedWorkRefusal("permission", bookPage)).toBeNull();
    expect(publishedWorkRefusal("mine", page)).toBeNull();
    expect(publishedWorkMarkers(page)).toEqual([]);
  });
});
