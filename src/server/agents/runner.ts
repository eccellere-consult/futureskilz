import { randomUUID } from "node:crypto";

import type { AgentContext, AgentDefinition } from "./registry";

export type AgentRunRecord = {
  id: string;
  agentName: string;
  agentVersion: string;
  status: "started" | "succeeded" | "failed";
  startedAt: Date;
  completedAt?: Date;
  latencyMs?: number;
  input: unknown;
  output?: unknown;
  error?: string;
};

export interface AgentRunRecorder {
  record(run: AgentRunRecord): Promise<void>;
}

export class ConsoleAgentRunRecorder implements AgentRunRecorder {
  async record(run: AgentRunRecord): Promise<void> {
    console.info("Agent run", {
      id: run.id,
      agent: `${run.agentName}@${run.agentVersion}`,
      status: run.status,
      latencyMs: run.latencyMs,
    });
  }
}

export class AgentRunner {
  constructor(private readonly recorder: AgentRunRecorder) {}

  async run<TInput, TOutput>(
    agent: AgentDefinition<TInput, TOutput>,
    rawInput: unknown,
    context: AgentContext = {},
  ): Promise<TOutput> {
    const id = randomUUID();
    const startedAt = new Date();
    const input = agent.inputSchema.parse(rawInput);
    const startedRun: AgentRunRecord = {
      id,
      agentName: agent.name,
      agentVersion: agent.version,
      status: "started",
      startedAt,
      input,
    };
    await this.recorder.record(startedRun);

    try {
      const rawOutput = await agent.execute(input, context);
      const output = agent.outputSchema.parse(rawOutput);
      const completedAt = new Date();
      await this.recorder.record({
        ...startedRun,
        status: "succeeded",
        output,
        completedAt,
        latencyMs: completedAt.getTime() - startedAt.getTime(),
      });
      return output;
    } catch (error) {
      const completedAt = new Date();
      await this.recorder.record({
        ...startedRun,
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown agent failure",
        completedAt,
        latencyMs: completedAt.getTime() - startedAt.getTime(),
      });
      throw error;
    }
  }
}
