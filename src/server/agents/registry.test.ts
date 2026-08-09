import { describe, expect, it } from "vitest";
import { z } from "zod";

import { AgentRegistry } from "./registry";

const testAgent = {
  name: "goal",
  version: "1.0.0",
  inputSchema: z.object({ goal: z.string() }),
  outputSchema: z.object({ normalizedGoal: z.string() }),
  costCeilingMicros: 1_000,
  requiresApproval: false,
  async execute(input: { goal: string }) {
    return { normalizedGoal: input.goal.trim() };
  },
};

describe("AgentRegistry", () => {
  it("registers and resolves an agent by version", () => {
    const registry = new AgentRegistry();
    registry.register(testAgent);

    expect(registry.get("goal", "1.0.0")).toBe(testAgent);
    expect(registry.list()).toEqual([
      { name: "goal", version: "1.0.0", requiresApproval: false },
    ]);
  });

  it("rejects duplicate registrations", () => {
    const registry = new AgentRegistry();
    registry.register(testAgent);

    expect(() => registry.register(testAgent)).toThrow("Agent already registered");
  });
});
