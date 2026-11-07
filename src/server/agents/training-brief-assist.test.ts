import { describe, expect, it } from "vitest";

import { assistInputSchema, mergeSuggestions, scaffoldAssist } from "../../features/tna/assist";
import { DeterministicAiProvider, type AiProvider } from "../providers/ai";
import { createBriefAssistAgent } from "./training-brief-assist";

const input = assistInputSchema.parse({ topic: "Supervisors leading shop-floor quality" });

function provider(replies: Array<string | Error>): AiProvider & { calls: number } {
  const state = { calls: 0 };
  return {
    name: "openai",
    model: "test",
    get calls() { return state.calls; },
    async generate() {
      const next = replies[Math.min(state.calls, replies.length - 1)];
      state.calls += 1;
      if (next instanceof Error) throw next;
      return { content: next, provider: "openai", model: "test", usage: { inputTokens: 1, outputTokens: 1, costMicros: 0 } };
    },
  } as AiProvider & { calls: number };
}

const good = JSON.stringify({
  suggestions: { role: "First-line supervisors", level: "working", goal: "Fewer rejected batches each month.", minutesPerLearner: 240, notes: null },
  questions: [{ question: "Do the learners work in shifts?", why: "It changes how the pieces are scheduled.", options: ["Yes", "No"] }],
});

describe("brief assist: merging suggestions", () => {
  it("fills empty boxes and never overwrites what the person typed", () => {
    const { values, aiFilled } = mergeSuggestions({ role: "My own words", level: undefined, goal: "", minutesPerLearner: undefined, notes: "" }, new Set(), { role: "Suggested role", level: "advanced", goal: "A goal", minutesPerLearner: 120 });
    expect(values.role).toBe("My own words");
    expect(values.level).toBe("advanced");
    expect(values.goal).toBe("A goal");
    expect(values.minutesPerLearner).toBe(120);
    expect([...aiFilled].sort()).toEqual(["goal", "level", "minutesPerLearner"]);
  });

  it("lets a later suggestion refine an earlier suggestion, but not a box the person has since edited", () => {
    const first = mergeSuggestions({ role: "", goal: "" }, new Set(), { role: "Role one", goal: "Goal one" });
    const edited = new Set(first.aiFilled);
    edited.delete("goal");
    const second = mergeSuggestions({ role: first.values.role, goal: "I changed this" }, edited, { role: "Role two", goal: "Goal two" });
    expect(second.values.role).toBe("Role two");
    expect(second.values.goal).toBe("I changed this");
  });
});

describe("brief assist: the plain fallback", () => {
  it("asks tap-to-answer questions for what is empty, at most three", () => {
    const result = scaffoldAssist(input);
    expect(result.source).toBe("scaffold");
    expect(result.questions.length).toBe(3);
    expect(result.questions.every((q) => q.options.length >= 2)).toBe(true);
    expect(result.suggestions).toEqual({});
  });

  it("turns the taps into entries and stops asking what is answered or already typed", () => {
    const answered = scaffoldAssist(assistInputSchema.parse({ topic: input.topic, answers: [{ question: "Who will be in the room?", answer: "First-line supervisors" }, { question: "How much time can each learner give in total?", answer: "About half a day" }] }));
    expect(answered.suggestions.role).toBe("First-line supervisors");
    expect(answered.suggestions.minutesPerLearner).toBe(240);
    expect(answered.questions.map((q) => q.question)).toEqual(["What is going wrong today that this training should fix?"]);
    const typed = scaffoldAssist(assistInputSchema.parse({ topic: input.topic, role: "x supervisors", goal: "Fewer defects", minutesPerLearner: 60 }));
    expect(typed.questions).toEqual([]);
  });
});

describe("brief assist agent", () => {
  it("uses the plain fallback with no AI", async () => {
    const result = await createBriefAssistAgent(new DeterministicAiProvider()).execute(input, {});
    expect(result.source).toBe("scaffold");
  });

  it("returns the AI's suggestions and questions, cleaning nulls", async () => {
    const result = await createBriefAssistAgent(provider([good])).execute(input, {});
    expect(result.source).toBe("ai");
    expect(result.suggestions).toMatchObject({ role: "First-line supervisors", level: "working", minutesPerLearner: 240 });
    expect(result.suggestions.notes).toBeUndefined();
    expect(result.questions).toHaveLength(1);
  });

  it("never asks a question that was already answered", async () => {
    const answered = assistInputSchema.parse({ topic: input.topic, answers: [{ question: "Do the learners work in shifts?", answer: "Yes" }] });
    const result = await createBriefAssistAgent(provider([good])).execute(answered, {});
    expect(result.questions).toEqual([]);
  });

  it("repairs a bad answer once, then falls back to plain questions", async () => {
    const repaired = provider(["not json", good]);
    expect((await createBriefAssistAgent(repaired).execute(input, {})).source).toBe("ai");
    expect(repaired.calls).toBe(2);
    const failing = await createBriefAssistAgent(provider([new Error("down")])).execute(input, {});
    expect(failing.source).toBe("scaffold");
    const unusable = await createBriefAssistAgent(provider(["{\"suggestions\":{\"level\":\"expert\"}}", "{\"suggestions\":{\"level\":\"expert\"}}"])).execute(input, {});
    expect(unusable.source).toBe("scaffold");
  });
});
