import { describe, expect, it } from "vitest";

import { rootCauseSkillShot as bp } from "../skillshot/samples/root-cause";
import { reviewPracticeByRules, validateAiFeedback } from "./practice";

const good =
  "Last week our dispatch orders for one customer were late again. The problem: orders for that customer shipped a day late. Why 1: the packers were waiting for labels, which I checked on the label timestamps. Why 2: the labels printed late because the quantity was confirmed late. The deepest cause I can change is that nobody books the last batch before the shift ends, so my action is a five-minute handover.";

describe("practice feedback without an AI", () => {
  it("asks for more when the note is too short, and says why", () => {
    const f = reviewPracticeByRules(bp, "It was late.");
    expect(f.source).toBe("rules");
    expect(f.criteria.every((c) => c.status === "not-yet")).toBe(true);
    expect(f.overall).toMatch(/very short/);
  });

  it("reads a good note against the lesson's own criteria and quotes the learner's own words", () => {
    const f = reviewPracticeByRules(bp, good);
    expect(f.criteria.map((c) => c.criterion)).toEqual(bp.design.successCriteria);
    expect(f.criteria.some((c) => c.status === "met")).toBe(true);
    for (const c of f.criteria) if (c.evidence) expect(good.toLowerCase()).toContain(c.evidence.toLowerCase().replace(/…$/, "").slice(0, 30));
    expect(f.overall).toMatch(/automatic reading by keywords/);
    expect(f.overall).toMatch(/specific situation/);
  });

  it("does not pretend to see criteria that the note does not touch", () => {
    const off = "I think teamwork is important in every company and people should always communicate well with each other about everything they do daily.";
    const f = reviewPracticeByRules(bp, off);
    expect(f.criteria.filter((c) => c.status === "met")).toHaveLength(0);
    expect(f.nextStep).toMatch(/Add the part about|Say more about/);
  });
});

describe("checking an AI's feedback before it is shown", () => {
  const criteria = bp.design.successCriteria;
  const make = (over: Record<string, unknown> = {}) => ({
    overall: "You described a real situation and a cause you can change.",
    criteria: criteria.map((_, i) => ({ status: i === 0 ? "met" : "partly", evidence: i === 0 ? "orders for that customer shipped a day late" : "", next: "Say how you checked it." })),
    nextStep: "Share it with your team lead.",
    ...over,
  });

  it("accepts a well-formed review and keeps a quote only if the learner really wrote it", () => {
    const f = validateAiFeedback(JSON.stringify(make()), bp, good)!;
    expect(f.source).toBe("ai");
    expect(f.criteria[0]).toMatchObject({ status: "met", evidence: "orders for that customer shipped a day late" });
    const faked = validateAiFeedback(make({ criteria: criteria.map(() => ({ status: "met", evidence: "I solved world hunger", next: "x" })) }), bp, good)!;
    expect(faked.criteria.every((c) => c.evidence === "")).toBe(true);
    // "Met" with nothing to point to cannot be checked, so it is shown as "partly".
    expect(faked.criteria.every((c) => c.status === "partly")).toBe(true);
  });

  it("rejects the wrong number of criteria, an unknown status, and text that is not JSON", () => {
    expect(validateAiFeedback(make({ criteria: [] }), bp, good)).toBeNull();
    expect(validateAiFeedback(make({ criteria: criteria.map(() => ({ status: "excellent", evidence: "", next: "x" })) }), bp, good)).toBeNull();
    expect(validateAiFeedback("Great job!", bp, good)).toBeNull();
    expect(validateAiFeedback("```json\n" + JSON.stringify(make()) + "\n```", bp, good)).not.toBeNull();
  });
});
