import { z } from "zod";

export type AgentContext = {
  userId?: string;
  conversationId?: string;
};

export type AgentDefinition<TInput, TOutput> = {
  name: string;
  version: string;
  inputSchema: z.ZodType<TInput>;
  outputSchema: z.ZodType<TOutput>;
  costCeilingMicros: number;
  requiresApproval: boolean;
  execute(input: TInput, context: AgentContext): Promise<TOutput>;
};

export class AgentRegistry {
  private readonly agents = new Map<string, AgentDefinition<unknown, unknown>>();

  register<TInput, TOutput>(agent: AgentDefinition<TInput, TOutput>): void {
    const key = `${agent.name}@${agent.version}`;

    if (this.agents.has(key)) {
      throw new Error(`Agent already registered: ${key}`);
    }

    this.agents.set(key, agent as AgentDefinition<unknown, unknown>);
  }

  get<TInput, TOutput>(name: string, version: string): AgentDefinition<TInput, TOutput> {
    const key = `${name}@${version}`;
    const agent = this.agents.get(key);

    if (!agent) {
      throw new Error(`Agent not registered: ${key}`);
    }

    return agent as AgentDefinition<TInput, TOutput>;
  }

  list(): Array<{ name: string; version: string; requiresApproval: boolean }> {
    return [...this.agents.values()].map(({ name, version, requiresApproval }) => ({
      name,
      version,
      requiresApproval,
    }));
  }
}
