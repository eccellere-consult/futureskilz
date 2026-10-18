import "server-only";

import { NextResponse } from "next/server";

import { DatabaseAgentRunRecorder } from "@/server/agents/database-recorder";
import { AgentRunner } from "@/server/agents/runner";
import { createWelcomeSummaryAgent } from "@/server/agents/welcome-summary";
import { createCurrentAuthProvider } from "@/server/auth/current-provider";
import type { AuthSession } from "@/server/auth/provider";
import { createDatabase } from "@/server/db/client";
import { createProviders } from "@/server/providers";

import { LearnerRepository } from "./learner-repository";

export const noStore = { "Cache-Control": "no-store" };

export async function currentSession(): Promise<AuthSession | null> {
  return (await createCurrentAuthProvider()).getSession();
}

export function unauthorized() {
  return NextResponse.json({ error: "Sign in to continue." }, { status: 401, headers: noStore });
}

export function learnerRepository() {
  return new LearnerRepository(createDatabase());
}

/** Arya's summary is helpful, never critical: a failure leaves the profile without one. */
export async function refreshWelcomeSummary(userId: string): Promise<void> {
  const repository = learnerRepository();
  const snapshot = await repository.loadSnapshot(userId);
  if (!snapshot.scores) return;

  const { ai } = createProviders();
  const runner = new AgentRunner(new DatabaseAgentRunRecorder(createDatabase(), ai));
  try {
    const result = await runner.run(
      createWelcomeSummaryAgent(ai),
      {
        name: snapshot.draft.name,
        currentRole: snapshot.draft.currentRole,
        goal: snapshot.draft.goal,
        challenge: snapshot.draft.challenge,
        scores: snapshot.scores,
        completedSkillShots: snapshot.completedSkillShots ?? [],
      },
      { userId },
    );
    await repository.saveWelcomeSummary(userId, result.summary, result.source);
  } catch (error) {
    console.error("Welcome summary failed", error instanceof Error ? error.message : error);
  }
}
