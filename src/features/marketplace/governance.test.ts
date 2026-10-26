import { describe, expect, it } from "vitest";

import { governanceFor, MODE_LABEL, type RiskInputs } from "./governance";

const base: RiskInputs = { text: "Plan a small project on one page", sourceKind: "method", hasRealClaims: false, fromCoach: false, newContributor: false, enterpriseSensitive: false, confidence: 0.9 };

describe("governance by risk", () => {
  it("sends low-risk structured content through one editor's sign-off, never none", () => {
    const g = governanceFor(base);
    expect(g).toMatchObject({ mode: "A", risk: "low" });
    expect(g.steps).toEqual(["Automatic checks pass", "An editor reviews and publishes"]);
    expect(MODE_LABEL.A).toMatch(/editor sign-off/);
  });

  it("asks the coach to approve their own wording whenever a lesson was built from theirs", () => {
    const g = governanceFor({ ...base, fromCoach: true, sourceKind: "expert-interview" });
    expect(g.mode).toBe("B");
    expect(g.steps).toContain("The coach approves their own wording");
    expect(g.reasons.join(" ")).toMatch(/coach's own lesson/);
  });

  it("moves claims about real organisations to a second pair of eyes", () => {
    expect(governanceFor({ ...base, hasRealClaims: true }).mode).toBe("B");
    expect(governanceFor({ ...base, hasRealClaims: true }).steps).toContain("An editor checks the claims against their source");
  });

  it("sends regulated, medical, legal, financial, safety and employment topics to expert review and admin approval", () => {
    for (const text of ["How to handle a harassment complaint", "Dosing and medication basics", "Choosing a loan or insurance cover", "Lockout and chemical safety", "Your obligations under the DPDP Act", "Contract clause review for suppliers"]) {
      const g = governanceFor({ ...base, text });
      expect(g.mode, text).toBe("C");
      expect(g.steps.at(-1)).toBe("An admin approves and publishes");
    }
  });

  it("treats enterprise-sensitive content and low confidence with more care", () => {
    expect(governanceFor({ ...base, enterpriseSensitive: true }).mode).toBe("C");
    expect(governanceFor({ ...base, confidence: 0.3 }).mode).toBe("B");
    expect(governanceFor({ ...base, confidence: 0.3, newContributor: true, hasRealClaims: true }).mode).toBe("C");
  });

  it("always says why", () => {
    for (const input of [base, { ...base, text: "medical advice" }, { ...base, newContributor: true }]) expect(governanceFor(input).reasons.length).toBeGreaterThan(0);
  });
});
