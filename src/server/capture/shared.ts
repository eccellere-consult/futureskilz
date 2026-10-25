import "server-only";

import { randomUUID } from "node:crypto";

import { and, asc, eq, inArray, max } from "drizzle-orm";

import { ensureDatabaseSchema } from "@/server/db/ensure-schema";
import { createDatabase, type Database } from "@/server/db/client";
import { kcAudit, kcFactSources, kcFacts, kcProjects, kcRoles, kcSegments, userRoles } from "@/server/db/schema";
import type { CareerRole, Fact, InterviewState, Segment } from "@/features/capture/types";

export type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
export type Executor = Database | Tx;

/** An error whose message is safe to show a person. */
export class CaptureError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "CaptureError";
  }
}

export async function database(): Promise<Database> {
  await ensureDatabaseSchema();
  return createDatabase();
}

export const newUuid = (): string => randomUUID();
export const iso = (value: Date | string | null | undefined): string => (value instanceof Date ? value.toISOString() : (value ?? new Date().toISOString()));

export async function audit(executor: Executor, actorId: string | null, action: string, entity: string, entityId: string | null, meta?: Record<string, unknown>): Promise<void> {
  await executor.insert(kcAudit).values({ actorId, action, entity, entityId, meta: meta ?? null });
}

export async function rolesOf(executor: Executor, userId: string): Promise<Set<string>> {
  const rows = await executor.select({ role: userRoles.role }).from(userRoles).where(eq(userRoles.userId, userId));
  return new Set(rows.map((row) => row.role));
}

export type ProjectRow = typeof kcProjects.$inferSelect;

/** The project, only for its owner (or staff when allowed). Anyone else gets "not found", never a hint it exists. */
export async function requireProject(executor: Executor, userId: string, projectId: string, options: { staff?: boolean; forUpdate?: boolean } = {}): Promise<ProjectRow> {
  const query = executor.select().from(kcProjects).where(eq(kcProjects.id, projectId)).limit(1);
  const [row] = options.forUpdate ? await query.for("update") : await query;
  if (!row) throw new CaptureError(404, "That interview was not found.");
  if (row.contributorId === userId) return row;
  if (options.staff) {
    const roles = await rolesOf(executor, userId);
    if (roles.has("editor") || roles.has("admin")) return row;
  }
  throw new CaptureError(404, "That interview was not found.");
}

export function readState(row: ProjectRow): InterviewState {
  return row.state as unknown as InterviewState;
}

export function toRole(row: typeof kcRoles.$inferSelect): CareerRole {
  return {
    id: row.id,
    company: row.company,
    title: row.title,
    industry: row.industry,
    location: row.location,
    startYear: row.startYear,
    endYear: row.endYear,
    ongoing: row.ongoing,
    datesApproximate: row.datesApproximate,
    summary: row.summary,
    sortOrder: row.sortOrder,
    confirmed: row.confirmed,
  };
}

export async function loadRoles(executor: Executor, projectId: string): Promise<CareerRole[]> {
  const rows = await executor.select().from(kcRoles).where(eq(kcRoles.projectId, projectId)).orderBy(asc(kcRoles.sortOrder), asc(kcRoles.createdAt));
  return rows.map(toRole);
}

export function toSegment(row: typeof kcSegments.$inferSelect): Segment {
  return {
    id: row.id,
    seq: row.seq,
    source: row.source,
    speaker: row.speaker,
    text: row.text,
    locator: row.locator,
    uploadId: row.uploadId,
    roleId: row.roleId,
    questionKey: row.questionKey,
    createdAt: iso(row.createdAt),
  };
}

export async function loadFacts(executor: Executor, projectId: string): Promise<Fact[]> {
  const rows = await executor.select().from(kcFacts).where(eq(kcFacts.projectId, projectId)).orderBy(asc(kcFacts.createdAt), asc(kcFacts.id));
  if (rows.length === 0) return [];
  const sources = await executor.select().from(kcFactSources).where(inArray(kcFactSources.factId, rows.map((row) => row.id)));
  const byFact = new Map<string, Array<{ segmentId: string; quote: string }>>();
  for (const source of sources) byFact.set(source.factId, [...(byFact.get(source.factId) ?? []), { segmentId: source.segmentId, quote: source.quote }]);
  return rows.map((row) => ({
    id: row.id,
    category: row.category as Fact["category"],
    kind: row.kind,
    title: row.title,
    statement: row.statement,
    details: row.details,
    roleId: row.roleId,
    processId: row.processId,
    confidence: row.confidence,
    reviewStatus: row.reviewStatus,
    sensitivity: row.sensitivity,
    permission: row.permission,
    anonymizedStatement: row.anonymizedStatement,
    sources: byFact.get(row.id) ?? [],
    machineExtracted: row.machineExtracted,
    version: row.version,
  }));
}

export async function loadSegmentsById(executor: Executor, ids: string[]): Promise<Segment[]> {
  if (ids.length === 0) return [];
  const rows = await executor.select().from(kcSegments).where(inArray(kcSegments.id, ids));
  return rows.map(toSegment);
}

export async function nextSeq(executor: Executor, projectId: string): Promise<number> {
  const [row] = await executor.select({ top: max(kcSegments.seq) }).from(kcSegments).where(eq(kcSegments.projectId, projectId));
  return (row?.top ?? 0) + 1;
}

export async function ownerOnly(executor: Executor, userId: string, projectId: string) {
  return requireProject(executor, userId, projectId);
}

export { and, eq };
