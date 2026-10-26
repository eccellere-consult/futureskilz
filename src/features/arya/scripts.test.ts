import { describe, expect, it } from "vitest";

import { ARYA_IS_AI, coachInterviewIntro, coachWelcome, coachWelcomeBack, dayPartOf, greeting, planAcknowledgement, studentWelcome } from "./scripts";

describe("Arya's scripts", () => {
  it("greets by the visitor's local time, and neutrally when the time is unknown", () => {
    expect([5, 11, 12, 16, 17, 23].map(dayPartOf)).toEqual(["morning", "morning", "afternoon", "afternoon", "evening", "evening"]);
    expect(dayPartOf(-1)).toBe("day");
    expect(greeting("morning", "Asha Rao")).toBe("Good morning, Asha.");
    expect(greeting("day")).toBe("Hello.");
  });

  it("always introduces herself and says she is an AI, in all three conversations", () => {
    for (const text of [studentWelcome("evening"), coachWelcome("morning"), coachInterviewIntro("afternoon", "Asha")]) {
      expect(text).toContain("Arya");
      expect(text).toContain(ARYA_IS_AI);
    }
  });

  it("offers the coach all three ways to shape the interview, and promises nothing she cannot keep", () => {
    const text = coachInterviewIntro("morning", "Asha");
    expect(text).toMatch(/lead/);
    expect(text).toMatch(/pick from my plan and edit/);
    expect(text).toMatch(/structure the interview yourself/);
    expect(text).toMatch(/nothing is published until you have reviewed and approved/);
    expect(coachWelcomeBack("evening", "Asha")).toContain("Nothing you told me before needs repeating.");
    expect(planAcknowledgement("self")).toMatch(/structure you chose/);
  });
});
