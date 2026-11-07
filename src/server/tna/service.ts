import "server-only";

import { and, desc, eq, isNull } from "drizzle-orm";

import { assistInputSchema, scaffoldAssist, type AssistResult } from "@/features/tna/assist";
import { toSkillShotBriefs } from "@/features/tna/briefs";
import { checkTree, type TreeCheck } from "@/features/tna/check";
import { addNode, flattenDraft, indentNode, mergeNodes, moveNode, outdentNode, removeNode, type Change } from "@/features/tna/tree";
import { knownSkills, needSchema, programBriefSchema, type Need, type ProgramBrief, type TopicNode } from "@/features/tna/types";
import { DatabaseAgentRunRecorder } from "@/server/agents/database-recorder";
import { AgentRunner } from "@/server/agents/runner";
import { createBriefAssistAgent } from "@/server/agents/training-brief-assist";
import { createTrainingNeedsAgent } from "@/server/agents/training-needs";
import { CaptureError, audit, database, newUuid, rolesOf } from "@/server/capture/shared";
import { createDatabase } from "@/server/db/client";
import { tnaPrograms, tnaTopics, users } from "@/server/db/schema";
import { createProviders } from "@/server/providers";
import type { SkillShotBrief } from "@/features/skillshot/scaffold";

type ProgramRow = typeof tnaPrograms.$inferSelect;
type TopicRow = typeof tnaTopics.$inferSelect;

export type ProgramSummary = { id: string; title: string; topic: string; status: ProgramRow["status"]; working: string | null; updatedAt: string };
export type ProgramDetail = ProgramSummary & {
  brief: ProgramBrief;
  needs: Need[];
  nodes: TopicNode[];
  check: TreeCheck;
  source: string;
  notes: string[];
};

/** A background step still marked as working after this long was lost (for example a restart), so it is cleared. */
const STALE_MS = 6 * 60_000;

async function access(userId: string): Promise<{ staff: boolean }> {
  const roles = await rolesOf(await database(), userId);
  const staff = roles.has("editor") || roles.has("admin");
  if (!staff && !roles.has("contributor")) throw new CaptureError(403, "Planning a training is for coaches and editors.");
  return { staff };
}

async function loadProgram(userId: string, id: string): Promise<ProgramRow> {
  const { staff } = await access(userId);
  const db = await database();
  const [row] = await db.select().from(tnaPrograms).where(eq(tnaPrograms.id, id));
  if (!row || (!staff && row.ownerId !== userId)) throw new CaptureError(404, "That training plan was not found.");
  return row;
}

const briefOf = (row: ProgramRow): ProgramBrief => {
  const audience = row.audience as Record<string, unknown>;
  const constraints = (row.constraints ?? {}) as Record<string, unknown>;
  const parsed = programBriefSchema.safeParse({ topic: row.topic, audience, goal: row.goal ?? "", constraints, context: (audience.context as string | undefined) ?? "" });
  if (parsed.success) return parsed.data;
  throw new CaptureError(500, "That plan could not be read.");
};

const toNode = (row: TopicRow): TopicNode => ({
  id: row.id,
  parentId: row.parentId,
  position: row.position,
  title: row.title,
  summary: row.summary ?? "",
  targetLevel: row.targetLevel,
  skills: row.skillSlugs ?? [],
  needIds: row.needIds ?? [],
  prerequisites: row.prerequisites ?? [],
  materialHint: row.materialHint ?? "",
  evidenceSignal: row.evidenceSignal ?? "",
  minutes: row.minutes,
  status: row.status,
  origin: row.origin,
});

const needsOf = (row: ProgramRow): Need[] => (row.needs ?? []).flatMap((item) => {
  const parsed = needSchema.safeParse(item);
  return parsed.success ? [parsed.data] : [];
});

const summarise = (row: ProgramRow): ProgramSummary => ({ id: row.id, title: row.title, topic: row.topic, status: row.status, working: row.working, updatedAt: row.updatedAt.toISOString() });

async function loadNodes(programId: string): Promise<TopicNode[]> {
  const db = await database();
  return (await db.select().from(tnaTopics).where(eq(tnaTopics.programId, programId))).map(toNode);
}

async function saveNodes(programId: string, nodes: TopicNode[]): Promise<void> {
  const db = await database();
  await db.transaction(async (tx) => {
    await tx.delete(tnaTopics).where(eq(tnaTopics.programId, programId));
    // Parents first, so a reader never sees a child before its parent.
    for (const node of nodes) {
      await tx.insert(tnaTopics).values({ id: node.id, programId, parentId: node.parentId, position: node.position, title: node.title.slice(0, 200), summary: node.summary, targetLevel: node.targetLevel, skillSlugs: node.skills, needIds: node.needIds, prerequisites: node.prerequisites, materialHint: node.materialHint, evidenceSignal: node.evidenceSignal, minutes: node.minutes, status: node.status, origin: node.origin });
    }
    await tx.update(tnaPrograms).set({ status: "draft" }).where(and(eq(tnaPrograms.id, programId), eq(tnaPrograms.status, "approved")));
  });
}

/** Suggests the empty boxes of a new plan and asks the few questions that would change them. One short AI call; nothing is saved. */
export async function assistBrief(userId: string, input: unknown): Promise<AssistResult> {
  await access(userId);
  const parsed = assistInputSchema.safeParse(input);
  if (!parsed.success) throw new CaptureError(400, parsed.error.issues[0]?.message ?? "Please check the details.");
  const { ai } = createProviders();
  const runner = new AgentRunner(new DatabaseAgentRunRecorder(createDatabase(), ai));
  try {
    return await runner.run(createBriefAssistAgent(ai), parsed.data, { userId });
  } catch (error) {
    console.error("[tna assist]", error instanceof Error ? error.message : error);
    return { ...scaffoldAssist(parsed.data), notes: ["The AI is not available right now, so these are plain questions instead. You can try again."] };
  }
}

export async function listPrograms(userId: string): Promise<ProgramSummary[]> {
  const { staff } = await access(userId);
  const db = await database();
  const rows = staff ? await db.select().from(tnaPrograms).orderBy(desc(tnaPrograms.updatedAt)).limit(100) : await db.select().from(tnaPrograms).where(eq(tnaPrograms.ownerId, userId)).orderBy(desc(tnaPrograms.updatedAt)).limit(100);
  return rows.map(summarise);
}

export async function createProgram(userId: string, input: unknown): Promise<{ id: string }> {
  await access(userId);
  const parsed = programBriefSchema.safeParse(input);
  if (!parsed.success) throw new CaptureError(400, parsed.error.issues[0]?.message ?? "Please check the details.");
  const brief = parsed.data;
  const id = newUuid();
  const db = await database();
  await db.insert(tnaPrograms).values({ id, ownerId: userId, title: brief.topic.slice(0, 200), topic: brief.topic, audience: { ...brief.audience, context: brief.context }, goal: brief.goal, constraints: brief.constraints, needs: [], status: "draft", source: "scaffold", notes: [] });
  await audit(db, userId, "tna.create", "tna_program", id, {});
  return { id };
}

export async function getProgram(userId: string, id: string): Promise<ProgramDetail> {
  let row = await loadProgram(userId, id);
  const db = await database();
  if (row.working && row.workingSince && Date.now() - row.workingSince.getTime() > STALE_MS) {
    await db.update(tnaPrograms).set({ working: null, workingSince: null, notes: ["The last step took too long and was stopped. Try it again."] }).where(eq(tnaPrograms.id, id));
    row = await loadProgram(userId, id);
  }
  const nodes = await loadNodes(id);
  const needs = needsOf(row);
  return { ...summarise(row), brief: briefOf(row), needs, nodes, check: checkTree(nodes, needs), source: row.source, notes: row.notes ?? [] };
}

/** Saves the person's edits to the needs: confirm, reject, reword, reprioritise, or add. */
export async function saveNeeds(userId: string, id: string, input: unknown): Promise<void> {
  const row = await loadProgram(userId, id);
  if (!Array.isArray(input) || input.length > 20) throw new CaptureError(400, "Please send up to 20 needs.");
  const needs: Need[] = [];
  for (const item of input) {
    const parsed = needSchema.safeParse({ ...(item as object), id: (item as { id?: string })?.id || `n_${newUuid().slice(0, 8)}`, askClient: (item as { askClient?: string | null })?.askClient ?? null });
    if (!parsed.success) throw new CaptureError(400, `A need could not be saved: ${parsed.error.issues[0]?.message ?? "check it"}.`);
    needs.push(parsed.data);
  }
  const db = await database();
  await db.update(tnaPrograms).set({ needs, status: "draft" }).where(eq(tnaPrograms.id, row.id));
  await audit(db, userId, "tna.needs", "tna_program", id, { count: needs.length });
}

/** Marks the step as working and returns at once; the agent finishes in the background and the page polls. */
export async function startStep(userId: string, id: string, step: "needs" | "tree"): Promise<void> {
  const row = await loadProgram(userId, id);
  const db = await database();
  if (row.working) throw new CaptureError(409, "A step is already running for this plan. Wait for it to finish.");
  if (step === "tree") {
    if (!needsOf(row).some((need) => need.status !== "rejected")) throw new CaptureError(400, "Confirm at least one learner need first.");
    const nodes = await loadNodes(id);
    if (nodes.some((node) => node.status === "approved")) throw new CaptureError(409, "Some topics are already approved. Change them by hand, or set them back to proposed first.");
  }
  const [claim] = await db.update(tnaPrograms).set({ working: step, workingSince: new Date(), notes: [] }).where(and(eq(tnaPrograms.id, id), isNull(tnaPrograms.working)));
  if (!claim || claim.affectedRows === 0) throw new CaptureError(409, "A step is already running for this plan. Wait for it to finish.");
  void runStep(userId, id, step);
}

async function runStep(userId: string, id: string, step: "needs" | "tree"): Promise<void> {
  const db = await database();
  try {
    const row = await loadProgram(userId, id);
    const brief = briefOf(row);
    const needs = needsOf(row);
    const { ai } = createProviders();
    const runner = new AgentRunner(new DatabaseAgentRunRecorder(createDatabase(), ai));
    const result = await runner.run(createTrainingNeedsAgent(ai), { step, brief, needs }, { userId });
    if (step === "needs" && result.needs) {
      // Keep what the person already confirmed; replace the rest with the new proposals.
      const kept = needs.filter((need) => need.status === "confirmed");
      const fresh: Need[] = result.needs.needs
        .filter((draft) => !kept.some((need) => need.statement.trim().toLowerCase() === draft.statement.trim().toLowerCase()))
        .map((draft) => ({ ...draft, askClient: draft.askClient ?? null, id: `n_${newUuid().slice(0, 8)}`, status: "proposed" as const }));
      await db.update(tnaPrograms).set({ needs: [...kept, ...fresh], source: result.source, notes: result.notes, status: "draft" }).where(eq(tnaPrograms.id, id));
    } else if (step === "tree" && result.tree) {
      const live = needs.filter((need) => need.status !== "rejected").map((need) => need.id);
      const nodes = flattenDraft(result.tree.modules, newUuid).map((node) => ({ ...node, needIds: node.needIds.filter((n) => live.includes(n)), skills: node.skills.filter((s) => knownSkills.has(s)) }));
      await saveNodes(id, nodes);
      await db.update(tnaPrograms).set({ source: result.source, notes: result.notes }).where(eq(tnaPrograms.id, id));
    }
    await audit(db, userId, `tna.${step}`, "tna_program", id, { source: result.source, attempts: result.attempts });
  } catch (error) {
    console.error("[tna step]", error instanceof Error ? error.message : error);
    await db.update(tnaPrograms).set({ notes: ["That step could not be completed. Please try again."] }).where(eq(tnaPrograms.id, id)).catch(() => undefined);
  } finally {
    await db.update(tnaPrograms).set({ working: null, workingSince: null }).where(eq(tnaPrograms.id, id)).catch(() => undefined);
  }
}

export type TreeAction =
  | { action: "move"; id: string; direction: -1 | 1 }
  | { action: "indent" | "outdent" | "remove"; id: string }
  | { action: "add"; parentId: string | null; title: string }
  | { action: "merge"; id: string; withId: string }
  | { action: "update"; id: string; fields: Partial<Pick<TopicNode, "title" | "summary" | "targetLevel" | "skills" | "needIds" | "prerequisites" | "materialHint" | "evidenceSignal" | "minutes">> }
  | { action: "status"; id: string; status: TopicNode["status"] };

function apply(nodes: TopicNode[], input: TreeAction): Change {
  switch (input.action) {
    case "move": return moveNode(nodes, input.id, input.direction === -1 ? -1 : 1);
    case "indent": return indentNode(nodes, input.id);
    case "outdent": return outdentNode(nodes, input.id);
    case "remove": return removeNode(nodes, input.id);
    case "add": return addNode(nodes, input.parentId ?? null, input.title, newUuid);
    case "merge": return mergeNodes(nodes, input.id, input.withId);
    case "status": {
      if (!["proposed", "approved", "rejected"].includes(input.status)) return { ok: false, reason: "Unknown status." };
      return { ok: true, nodes: nodes.map((node) => (node.id === input.id ? { ...node, status: input.status } : node)) };
    }
    case "update": {
      if (!nodes.some((node) => node.id === input.id)) return { ok: false, reason: "That topic was not found." };
      const f = input.fields;
      if (f.skills && f.skills.some((slug) => !knownSkills.has(slug))) return { ok: false, reason: "That skill is not in the Skill Graph." };
      if (f.skills && f.skills.length > 4) return { ok: false, reason: "Choose at most 4 skills." };
      if (f.title !== undefined && f.title.trim().length < 3) return { ok: false, reason: "Give the topic a short name." };
      if (f.targetLevel != null && (f.targetLevel < 0.5 || f.targetLevel > 5)) return { ok: false, reason: "Target level is between 0.5 and 5." };
      if (f.minutes != null && (!Number.isInteger(f.minutes) || f.minutes < 1 || f.minutes > 120)) return { ok: false, reason: "Minutes must be between 1 and 120." };
      const ids = new Set(nodes.map((node) => node.id));
      if (f.prerequisites && (f.prerequisites.some((p) => !ids.has(p) || p === input.id) || f.prerequisites.length > 8)) return { ok: false, reason: "A prerequisite is not valid." };
      const clip = (value: string | undefined, max: number) => (value === undefined ? undefined : value.slice(0, max));
      return {
        ok: true,
        nodes: nodes.map((node) => (node.id === input.id ? { ...node, ...(f.title !== undefined ? { title: f.title.trim().slice(0, 200) } : {}), ...(f.summary !== undefined ? { summary: clip(f.summary, 600)! } : {}), ...(f.materialHint !== undefined ? { materialHint: clip(f.materialHint, 500)! } : {}), ...(f.evidenceSignal !== undefined ? { evidenceSignal: clip(f.evidenceSignal, 300)! } : {}), ...(f.skills ? { skills: f.skills } : {}), ...(f.needIds ? { needIds: f.needIds.slice(0, 8) } : {}), ...(f.prerequisites ? { prerequisites: f.prerequisites } : {}), ...(f.targetLevel !== undefined ? { targetLevel: f.targetLevel } : {}), ...(f.minutes !== undefined ? { minutes: f.minutes }: {}), status: node.status === "approved" ? "proposed" as const : node.status, origin: "person" as const } : node)),
      };
    }
    default: return { ok: false, reason: "Unknown action." };
  }
}

export async function editTree(userId: string, id: string, input: TreeAction): Promise<void> {
  const row = await loadProgram(userId, id);
  if (row.working) throw new CaptureError(409, "A step is running. Wait for it to finish.");
  const result = apply(await loadNodes(id), input);
  if (!result.ok) throw new CaptureError(400, result.reason);
  await saveNodes(id, result.nodes);
  const db = await database();
  await audit(db, userId, `tna.tree.${input.action}`, "tna_program", id, {});
}

/** Approves every topic that is not rejected, but only when no check blocks it. */
export async function approveProgram(userId: string, id: string): Promise<TreeCheck> {
  const row = await loadProgram(userId, id);
  const nodes = (await loadNodes(id)).map((node) => (node.status === "rejected" ? node : { ...node, status: "approved" as const }));
  const check = checkTree(nodes, needsOf(row));
  if (!check.canApprove) throw new CaptureError(409, "Some points must be fixed before this plan can be approved.", { issues: check.issues.filter((issue) => issue.severity === "block") });
  await saveNodes(id, nodes);
  const db = await database();
  await db.update(tnaPrograms).set({ status: "approved" }).where(eq(tnaPrograms.id, id));
  await audit(db, userId, "tna.approve", "tna_program", id, { leaves: check.leafCount });
  return check;
}

export async function briefsFor(userId: string, id: string): Promise<SkillShotBrief[]> {
  const row = await loadProgram(userId, id);
  if (row.status !== "approved") throw new CaptureError(409, "Approve the plan first.");
  const db = await database();
  const [user] = await db.select().from(users).where(eq(users.id, row.ownerId));
  return toSkillShotBriefs(briefOf(row), await loadNodes(id), user?.displayName ?? "FutureSkilz coach");
}

export async function deleteProgram(userId: string, id: string): Promise<void> {
  const row = await loadProgram(userId, id);
  const db = await database();
  await db.delete(tnaPrograms).where(eq(tnaPrograms.id, row.id));
  await audit(db, userId, "tna.delete", "tna_program", id, {});
}

