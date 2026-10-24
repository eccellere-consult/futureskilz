/**
 * workspaceCases.ts — "My problems" (references/05 §3.3): the cases of a case-scoped section, one per problem a learner works
 * through the section's tools. Every read and write is limited to the signed-in learner's own cases; a case id is never
 * trusted from the browser without checking it belongs to them.
 */
import pool from './mysql';
import { ensureDatabaseSchema } from '../server/db/ensure-schema';

export type CaseStatus = 'open' | 'solved' | 'archived';

export interface WorkspaceCase {
  id: number;
  title: string;
  brief: string;
  status: CaseStatus;
  createdAt: string;
  updatedAt: string;
}

export const MAX_TITLE = 200;
export const MAX_BRIEF = 4000;

function rowToCase(row: Record<string, unknown>): WorkspaceCase {
  return {
    id: Number(row.id),
    title: String(row.title ?? ''),
    brief: String(row.brief ?? ''),
    status: (row.status as CaseStatus) ?? 'open',
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  };
}

/** A learner's cases in a section, most recently touched first. Archived ones are left out unless asked for. */
export async function listCases(clientId: string, section: string, opts: { includeArchived?: boolean } = {}): Promise<WorkspaceCase[]> {
  await ensureDatabaseSchema();
  const [rows] = (await pool.query(
    `SELECT id, title, brief, status, created_at, updated_at FROM ws_cases
     WHERE client_id = ? AND section = ? ${opts.includeArchived ? '' : "AND status <> 'archived'"}
     ORDER BY updated_at DESC, id DESC`,
    [clientId, section]
  )) as [Record<string, unknown>[], unknown];
  return rows.map(rowToCase);
}

/** The case, only when it belongs to this learner and section; null otherwise (a stranger's id looks exactly like a missing one). */
export async function getCase(clientId: string, section: string, caseId: number): Promise<WorkspaceCase | null> {
  if (!Number.isInteger(caseId) || caseId <= 0) return null;
  await ensureDatabaseSchema();
  const [rows] = (await pool.query(
    'SELECT id, title, brief, status, created_at, updated_at FROM ws_cases WHERE id = ? AND client_id = ? AND section = ? LIMIT 1',
    [caseId, clientId, section]
  )) as [Record<string, unknown>[], unknown];
  return rows.length ? rowToCase(rows[0]) : null;
}

export async function createCase(clientId: string, section: string, title: string, brief: string): Promise<WorkspaceCase> {
  await ensureDatabaseSchema();
  const [result] = (await pool.query('INSERT INTO ws_cases (client_id, section, title, brief) VALUES (?, ?, ?, ?)', [
    clientId,
    section,
    title.trim().slice(0, MAX_TITLE),
    brief.trim().slice(0, MAX_BRIEF),
  ])) as [{ insertId: number }, unknown];
  const created = await getCase(clientId, section, result.insertId);
  if (!created) throw new Error('The problem could not be saved.');
  return created;
}

/** Renames a case, edits its brief or changes its status. Only the learner's own case is touched. */
export async function updateCase(
  clientId: string,
  section: string,
  caseId: number,
  changes: Partial<Pick<WorkspaceCase, 'title' | 'brief' | 'status'>>
): Promise<WorkspaceCase | null> {
  const existing = await getCase(clientId, section, caseId);
  if (!existing) return null;
  const next = {
    title: (changes.title ?? existing.title).trim().slice(0, MAX_TITLE) || existing.title,
    brief: (changes.brief ?? existing.brief).trim().slice(0, MAX_BRIEF),
    status: changes.status ?? existing.status,
  };
  await pool.query('UPDATE ws_cases SET title = ?, brief = ?, status = ? WHERE id = ? AND client_id = ? AND section = ?', [
    next.title,
    next.brief,
    next.status,
    caseId,
    clientId,
    section,
  ]);
  return getCase(clientId, section, caseId);
}

/** "THE PROBLEM IN HAND: …", placed first in every AI prompt so all tools of a case are written about the same problem. */
export function caseBlock(c: Pick<WorkspaceCase, 'title' | 'brief'>): string {
  const brief = c.brief.trim();
  return `THE PROBLEM IN HAND: ${c.title.trim()}.${brief ? ` ${brief}` : ''}`;
}
