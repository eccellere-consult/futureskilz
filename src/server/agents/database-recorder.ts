import "server-only";

import { eq } from "drizzle-orm";

import type { Database } from "@/server/db/client";
import { agentRuns } from "@/server/db/schema";

import type { AgentRunRecord, AgentRunRecorder } from "./runner";

/** Persists every agent run so inputs, outputs, failures and latency can be audited later. */
export class DatabaseAgentRunRecorder implements AgentRunRecorder {
  constructor(
    private readonly database: Database,
    private readonly provider: { name: string; model: string },
  ) {}

  async record(run: AgentRunRecord): Promise<void> {
    const asRecord = (value: unknown) =>
      value !== null && typeof value === "object" ? (value as Record<string, unknown>) : { value };

    if (run.status === "started") {
      await this.database.insert(agentRuns).values({
        id: run.id,
        agentName: run.agentName,
        agentVersion: run.agentVersion,
        provider: this.provider.name,
        model: this.provider.model,
        status: "started",
        input: asRecord(run.input),
        startedAt: run.startedAt,
      });
      return;
    }

    await this.database
      .update(agentRuns)
      .set({
        status: run.status,
        output: run.output === undefined ? null : asRecord(run.output),
        error: run.error ?? null,
        latencyMs: run.latencyMs ?? null,
        completedAt: run.completedAt ?? new Date(),
      })
      .where(eq(agentRuns.id, run.id));
  }
}
