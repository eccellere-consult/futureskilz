import "server-only";

import { and, desc, eq, isNotNull } from "drizzle-orm";

import { COACH_SUGGESTIONS } from "@/features/coach/rules";
import { MAX_NOTE_CHARS, type PracticeFeedback } from "@/features/coach/practice";
import { CRISIS_REPLY, EMPTY_REPLY, INJECTION_REPLY, REDACTED_NOTE, isCrisis, redact, screenInput } from "@/features/coach/safety";
import { DatabaseAgentRunRecorder } from "@/server/agents/database-recorder";
import { createCoachAgent, createPracticeFeedbackAgent, type CoachInput } from "@/server/agents/coach";
import { AgentRunner } from "@/server/agents/runner";
import { CaptureError, database, newUuid, rolesOf } from "@/server/capture/shared";
import { createDatabase } from "@/server/db/client";
import { coachMessages } from "@/server/db/schema";
import { createProviders } from "@/server/providers";
import { findDesigned } from "@/server/skillshots/designed";

export type CoachAnswer = { reply: string; suggestions: string[]; source: "ai" | "rules" | "safety"; flag: string | null };

/** In-memory limits, per server process. A visitor who is not signed in gets fewer, since nothing ties them to an account. */
const hits = new Map<string, number[]>();
export function allow(key: string, limit: number, windowMs = 10 * 60_000, now = Date.now()): boolean {
  const recent = (hits.get(key) ?? []).filter((time) => now - time < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) for (const [k, v] of hits) if (v.every((t) => now - t >= windowMs)) hits.delete(k);
  return true;
}
export const resetLimits = () => hits.clear();

async function log(entry: { userId: string | null; skillShotId: string; kind: "question" | "practice"; message: string; reply: string; source: string; flag: string | null; payload?: Record<string, unknown> }) {
  if (!entry.userId) return; // nothing is kept for a visitor who is not signed in
  try {
    await createDatabase().insert(coachMessages).values({ id: newUuid(), userId: entry.userId, skillShotId: entry.skillShotId, kind: entry.kind, message: entry.message.slice(0, 4000), reply: entry.reply.slice(0, 4000), source: entry.source, flag: entry.flag, payload: entry.payload ?? null });
  } catch (error) {
    console.error("[coach log]", error instanceof Error ? error.message : error);
  }
}

export type AskInput = { userId: string | null; ip: string; skillShotId: string; message: string; scope: { sceneId?: string; answered: string[] }; history: CoachInput["history"] };

export async function askArya(input: AskInput): Promise<CoachAnswer> {
  const blueprint = await findDesigned(input.skillShotId);
  if (!blueprint) throw new CaptureError(404, "That Skill Shot was not found.");
  const screened = screenInput(input.message);
  const base = { userId: input.userId, skillShotId: blueprint.meta.id, kind: "question" as const };

  if (screened.action === "crisis") {
    await log({ ...base, message: "[held back: safety]", reply: CRISIS_REPLY, source: "safety", flag: "crisis" });
    return { reply: CRISIS_REPLY, suggestions: [], source: "safety", flag: "crisis" };
  }
  if (screened.action === "refuse") {
    const reply = screened.reason === "empty" ? EMPTY_REPLY : INJECTION_REPLY;
    if (screened.reason === "injection") await log({ ...base, message: redact(input.message.slice(0, 300)).text, reply, source: "safety", flag: "injection" });
    return { reply, suggestions: COACH_SUGGESTIONS, source: "safety", flag: screened.reason === "empty" ? null : "injection" };
  }
  if (!allow(input.userId ? `u:${input.userId}` : `ip:${input.ip}`, input.userId ? 30 : 10)) throw new CaptureError(429, "You have asked a lot just now. Please wait a few minutes, or read the lesson again.");

  const { ai } = createProviders();
  const runner = new AgentRunner(new DatabaseAgentRunRecorder(createDatabase(), ai));
  const history = input.history.slice(-4).map((turn) => ({ role: turn.role, text: redact(turn.text).text.slice(0, 800) }));
  const result = await runner.run(createCoachAgent(ai, blueprint), { message: screened.text, scope: input.scope, history }, { userId: input.userId ?? undefined });
  const reply = screened.redacted ? `${result.reply}${REDACTED_NOTE}` : result.reply;
  const flag = screened.redacted ? "redacted" : null;
  await log({ ...base, message: screened.text, reply, source: result.source, flag });
  return { reply, suggestions: result.suggestions, source: result.source, flag };
}

export async function reviewPracticeNote(input: { userId: string | null; ip: string; skillShotId: string; note: string }): Promise<PracticeFeedback & { flag: string | null }> {
  const blueprint = await findDesigned(input.skillShotId);
  if (!blueprint) throw new CaptureError(404, "That Skill Shot was not found.");
  if (isCrisis(input.note)) {
    await log({ userId: input.userId, skillShotId: blueprint.meta.id, kind: "practice", message: "[held back: safety]", reply: CRISIS_REPLY, source: "safety", flag: "crisis" });
    return { overall: CRISIS_REPLY, criteria: [], nextStep: "", source: "rules", flag: "crisis" };
  }
  // A practice note is longer than a question, so it is cleaned of personal details here and not cut to the question length.
  const cleaned = redact(input.note.replace(/\s+/g, " ").trim().slice(0, MAX_NOTE_CHARS));
  if (cleaned.text.length < 2) throw new CaptureError(400, "Write a few sentences about how you used this, then ask for feedback.");
  if (!allow(input.userId ? `pu:${input.userId}` : `pip:${input.ip}`, input.userId ? 8 : 4)) throw new CaptureError(429, "You have asked for feedback a few times just now. Please wait a few minutes.");

  const { ai } = createProviders();
  const runner = new AgentRunner(new DatabaseAgentRunRecorder(createDatabase(), ai));
  const feedback = await runner.run(createPracticeFeedbackAgent(ai, blueprint), { note: cleaned.text }, { userId: input.userId ?? undefined });
  const flag = cleaned.redacted ? "redacted" : null;
  await log({ userId: input.userId, skillShotId: blueprint.meta.id, kind: "practice", message: cleaned.text, reply: feedback.overall, source: feedback.source, flag, payload: { criteria: feedback.criteria, nextStep: feedback.nextStep } });
  return { ...feedback, flag };
}

export type LogRow = { id: string; skillShotId: string; kind: string; message: string; reply: string; source: string; flag: string | null; createdAt: string };

/** Editors and admins read the conversation log, to check safety and quality. Learners never see each other's. */
export async function listCoachLog(userId: string, filter: { flagged?: boolean } = {}): Promise<LogRow[]> {
  const db = await database();
  const roles = await rolesOf(db, userId);
  if (!roles.has("editor") && !roles.has("admin")) throw new CaptureError(403, "Only an editor can read the conversation log.");
  const rows = await db.select().from(coachMessages).where(filter.flagged ? isNotNull(coachMessages.flag) : undefined).orderBy(desc(coachMessages.createdAt)).limit(150);
  return rows.map((row) => ({ id: row.id, skillShotId: row.skillShotId, kind: row.kind, message: row.message, reply: row.reply, source: row.source, flag: row.flag, createdAt: row.createdAt.toISOString() }));
}

/** A learner may delete their own conversation with Arya about one Skill Shot. */
export async function deleteMyHistory(userId: string, skillShotId: string): Promise<{ deleted: boolean }> {
  const db = await database();
  await db.delete(coachMessages).where(and(eq(coachMessages.userId, userId), eq(coachMessages.skillShotId, skillShotId)));
  return { deleted: true };
}
