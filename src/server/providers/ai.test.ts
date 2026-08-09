import { describe, expect, it } from "vitest";

import {
  DeterministicAiProvider,
  FallbackAiProvider,
  type AiProvider,
  type AiRequest,
} from "./ai";

const request: AiRequest = {
  messages: [{ role: "user", content: "I want to become an AI-enabled leader." }],
};

describe("AI provider fallbacks", () => {
  it("uses the deterministic provider without credentials", async () => {
    const response = await new DeterministicAiProvider().generate(request);

    expect(response.provider).toBe("deterministic");
    expect(response.usage.costMicros).toBe(0);
    expect(response.content).toContain("AI-enabled leader");
  });

  it("moves to the next provider after a failure", async () => {
    const failingProvider: AiProvider = {
      name: "openai",
      model: "test-model",
      async generate() {
        throw new Error("provider unavailable");
      },
    };
    const chain = new FallbackAiProvider([failingProvider, new DeterministicAiProvider()]);

    await expect(chain.generate(request)).resolves.toMatchObject({ provider: "deterministic" });
  });
});
