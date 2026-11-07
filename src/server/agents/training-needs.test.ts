import { describe, expect, it } from "vitest";

import { programBriefSchema, type Need } from "../../features/tna/types";
import { DeterministicAiProvider, type AiProvider } from "../providers/ai";
import { createTrainingNeedsAgent } from "./training-needs";

const brief = programBriefSchema.parse({ topic: "Lean basics for line supervisors", audience: { role: "Line supervisors", level: "foundational" }, goal: "Fewer rework loops." });
const needs: Need[] = ["n1", "n2"].map((id) => ({ id, statement: `A need for ${id} in full`, evidence: "inferred", priority: "high", askClient: null, status: "confirmed" }));

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

const leaf = (title: string, skills: string[], needIds: string[]) => ({ title, summary: "Plain words.", skills, needIds, minutes: 8, targetLevel: 2 });
const goodTree = JSON.stringify({ modules: [{ title: "Module one", children: [leaf("First piece", ["problem-solving"], ["n1"]), leaf("Second piece", ["communication"], ["n2"])] }, { title: "Module two", children: [leaf("Third piece", ["decision-making"], ["n1"])] }] });
const badTree = JSON.stringify({ modules: [{ title: "Module one", children: [leaf("First piece", ["not-a-skill"], ["n1"])] }, { title: "Module two", children: [leaf("Third piece", ["decision-making"], [])] }] });
const goodNeeds = JSON.stringify({ needs: [1, 2, 3].map((n) => ({ statement: `Learners cannot yet do thing ${n}`, evidence: "inferred", priority: "high", askClient: "Is this right?" })) });

describe("training needs agent", () => {
  it("returns the plain scaffold with no AI and says so", async () => {
    const agent = createTrainingNeedsAgent(new DeterministicAiProvider());
    const needsResult = await agent.execute({ step: "needs", brief }, {});
    expect(needsResult.source).toBe("scaffold");
    expect(needsResult.needs?.needs.length).toBeGreaterThanOrEqual(3);
    expect(needsResult.notes.join(" ")).toMatch(/starting structure/);
    const treeResult = await agent.execute({ step: "tree", brief, needs }, {});
    expect(treeResult.tree?.modules.length).toBe(3);
  });

  it("accepts a valid needs answer on the first try, even inside a code fence", async () => {
    const ai = provider(["```json\n" + goodNeeds + "\n```"]);
    const result = await createTrainingNeedsAgent(ai).execute({ step: "needs", brief }, {});
    expect(result).toMatchObject({ source: "ai", attempts: 1 });
    expect(ai.calls).toBe(1);
  });

  it("accepts a valid tree", async () => {
    const result = await createTrainingNeedsAgent(provider([goodTree])).execute({ step: "tree", brief, needs }, {});
    expect(result).toMatchObject({ source: "ai", attempts: 1 });
    expect(result.tree?.modules).toHaveLength(2);
  });

  it("asks for a repair when a skill is unknown or a need is uncovered, then takes the repaired tree", async () => {
    const ai = provider([badTree, goodTree]);
    const result = await createTrainingNeedsAgent(ai).execute({ step: "tree", brief, needs }, {});
    expect(ai.calls).toBe(2);
    expect(result).toMatchObject({ source: "ai", attempts: 2 });
    expect(JSON.stringify(result.tree)).not.toContain("not-a-skill");
  });

  it("removes unknown skills and tells the person when the repair also fails", async () => {
    const result = await createTrainingNeedsAgent(provider([badTree, badTree])).execute({ step: "tree", brief, needs }, {});
    expect(result.source).toBe("ai");
    expect(JSON.stringify(result.tree)).not.toContain("not-a-skill");
    expect(result.notes.join(" ")).toMatch(/not in the Skill Graph/);
  });

  it("falls back to the scaffold when the AI cannot be reached or answers nonsense", async () => {
    const down = await createTrainingNeedsAgent(provider([new Error("down")])).execute({ step: "needs", brief }, {});
    expect(down.source).toBe("scaffold");
    const junk = await createTrainingNeedsAgent(provider(["I cannot help with that.", "still no"])).execute({ step: "tree", brief, needs }, {});
    expect(junk.source).toBe("scaffold");
  });

  it("does not send rejected needs to the model", async () => {
    const seen: string[] = [];
    const ai: AiProvider = { name: "openai", model: "t", async generate(request) { seen.push(request.messages[1].content); return { content: goodTree, provider: "openai", model: "t", usage: { inputTokens: 1, outputTokens: 1, costMicros: 0 } }; } };
    await createTrainingNeedsAgent(ai).execute({ step: "tree", brief, needs: [...needs, { ...needs[0], id: "n9", status: "rejected", statement: "A rejected need statement" }] }, {});
    expect(seen[0]).not.toContain("rejected need");
  });
});
