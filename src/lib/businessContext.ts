import "server-only";

import { eq } from "drizzle-orm";

import { createDatabase } from "@/server/db/client";
import { goals, learnerProfiles, users } from "@/server/db/schema";

/**
 * Context adapter for the framework workspace engine (references/07 §2, adapter 3). Eccellere grounds its AI in a company's
 * Business Context; FutureSkilz has no company profile, so it grounds the AI in the learner's own saved discovery answers:
 * their role, level of responsibility, the challenge they described and the goal they set. The AI then coaches a practice
 * problem in the learner's real working context instead of a generic one.
 */
export interface BusinessContextRow {
  displayName: string;
  currentRole: string | null;
  responsibilityLevel: string | null;
  challenge: string | null;
  goal: string | null;
  [k: string]: unknown;
}

export async function getBusinessContext(clientId: string): Promise<BusinessContextRow | null> {
  const database = createDatabase();
  const [row] = await database
    .select({
      displayName: users.displayName,
      currentRole: learnerProfiles.currentRole,
      responsibilityLevel: learnerProfiles.responsibilityLevel,
      challenge: learnerProfiles.challenge,
    })
    .from(users)
    .leftJoin(learnerProfiles, eq(learnerProfiles.userId, users.id))
    .where(eq(users.id, clientId))
    .limit(1);
  if (!row) return null;

  const [goal] = await database.select({ title: goals.title }).from(goals).where(eq(goals.learnerId, clientId)).limit(1);
  return { ...row, goal: goal?.title ?? null };
}

const responsibilityWords: Record<string, string> = {
  individual: "an individual contributor",
  manager: "a people or project manager",
  leader: "a business or functional leader",
  founder: "a founder or independent professional",
};

/** The learner's context as prompt text, or '' when the profile is too thin to help. */
export function businessContextToPromptBlock(context: BusinessContextRow | null): string {
  if (!context) return "";
  const lines = [
    context.currentRole ? `- Role: ${context.currentRole}` : null,
    context.responsibilityLevel && responsibilityWords[context.responsibilityLevel]
      ? `- Level of responsibility: ${responsibilityWords[context.responsibilityLevel]}`
      : null,
    context.goal ? `- The capability they are building: ${context.goal}` : null,
    context.challenge ? `- A recent challenge they described: ${context.challenge}` : null,
  ].filter(Boolean);
  if (lines.length === 0) return "";
  return `THE LEARNER (a FutureSkilz learner practising this method on a real problem from their own work — use this as context, never as a fact about their company):\n${lines.join("\n")}`;
}
