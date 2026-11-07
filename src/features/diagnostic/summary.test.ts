import { describe, expect, it } from "vitest";

import { diagnosticClose, diagnosticWelcome } from "../arya/scripts";
import { getRole } from "../pathway/roles";
import { summarise } from "./summary";

describe("closing the conversation", () => {
  const answers = [
    { questionId: "think-recurring-problem", option: 3, outcome: 2 },
    { questionId: "ai-recent-use", option: 0 },
    { questionId: "people-outside-authority", option: 1 },
    { questionId: "self-sudden-change", option: null },
  ];

  it("says what was heard, what it may mean, what is uncertain and what happens next", () => {
    const s = summarise(answers, getRole("ai-product-manager")!);
    expect(s.heard[0]).toMatch(/^A problem that came back: “I fixed the cause/);
    expect(s.heard.join(" ")).toMatch(/not been in one of these situations/);
    expect(s.mayMean.join(" ")).toMatch(/strengths|furthest|quickest|evenly/);
    expect(s.uncertain[0]).toMatch(/not measured results/);
    expect(s.uncertain.join(" ")).toMatch(/did not ask about/);
    expect(s.next.href).toBe("/journey");
    expect(s.next.label).toContain("AI Product Manager");
  });

  it("is honest when a result was described and when none was", () => {
    expect(summarise([{ questionId: "think-recurring-problem", option: 2 }]).uncertain.join(" ")).toMatch(/did not describe a specific result/);
    expect(summarise([{ questionId: "think-recurring-problem", option: 2, outcome: 2 }]).uncertain.join(" ")).not.toMatch(/did not describe a specific result/);
  });

  it("works with no answers at all", () => {
    const s = summarise([]);
    expect(s.mayMean).toHaveLength(1);
    expect(s.next.label).toMatch(/target role/);
  });
});

describe("Arya's lines", () => {
  it("greet formally, say she is an AI, and say that 'not in this situation' is a good answer", () => {
    const welcome = diagnosticWelcome("morning", "Priya");
    expect(welcome).toContain("Namaste, Priya. Good morning.");
    expect(welcome).toContain("I am an AI, not a person.");
    expect(welcome).toMatch(/not been in a situation recently/);
    expect(diagnosticClose()).toMatch(/Nothing here is a verdict/);
  });
});
