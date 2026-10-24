/**
 * strategyFillins.ts — per-person persistence for a framework workspace tool: its guided fill-in, the AI's written analysis
 * of it, and the Recommendations & Actionables generated from it (see /api/{section}/fillin, /generate and /analyze).
 *
 * FUTURESKILZ ADAPTATION of the Eccellere Strategy Hub file (commit f9c3ab4), as references/05 §3.2 prescribes:
 *   • the table is ws_fillins, shared by every section, and every call takes a SCOPE (learner, section, case) instead of a
 *     bare client id. A learner's 5W2H for one problem is never another problem's 5W2H;
 *   • the learner id is a FutureSkilz user id (text), not the hub's numeric client id;
 *   • every write raises `version` by one (references/05 §4), so a later change can detect a save from another tab;
 *   • the table is created by the site's self-setup (src/server/db/ensure-schema.ts), not by this file.
 * The save semantics are unchanged: partial saves keep what they do not touch, an analysis carries the fingerprint of the
 * answers it was written from, and the last bulk change (AI fill, template or document import) can be undone once.
 *
 * Everything the AI produces is saved by the SERVER at the moment it is produced — never left to a follow-up request from
 * the browser — so a closed tab or a dropped connection cannot lose it, and the tools downstream can always read it.
 *
 * Matches fields by label (see FrameworkField in strategyFrameworks.ts) — labels are this system's de facto field id. No
 * character limits on any stored text.
 */

import pool from './mysql';
import { ensureDatabaseSchema } from '../server/db/ensure-schema';
import type { FrameworkField } from './strategyFrameworks';
import {
  EMPTY_RECORD,
  fingerprintFields,
  type FieldChangeReason,
  type FillinRecord,
  type StrategyActionable,
  type StrategyAnalysis,
  type StrategyRecommendation,
} from './strategyFillinTypes';

export type { FillinRecord, StrategyActionable, StrategyAnalysis, StrategyRecommendation, FieldChangeReason };

/** Whose work, in which section, for which problem. `caseId` is 0 for a section without cases. */
export interface FillinScope {
  clientId: string;
  section: string;
  caseId: number;
}

function parseJson<T>(raw: unknown, fallback: T): T {
  if (raw === null || raw === undefined) return fallback;
  if (typeof raw !== 'string') return raw as T;
  if (!raw.trim()) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

const parseArray = <T>(raw: unknown): T[] => {
  const v = parseJson<unknown>(raw, []);
  return Array.isArray(v) ? (v as T[]) : [];
};

const toIso = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isFinite(d.getTime()) ? d.toISOString() : String(v);
};

function rowToRecord(row: Record<string, unknown>): FillinRecord {
  const analysis = parseJson<StrategyAnalysis | null>(row.analysis, null);
  const previous = parseArray<FrameworkField>(row.previous_fields);
  return {
    fields: parseArray<FrameworkField>(row.fields),
    recommendations: parseArray<StrategyRecommendation>(row.recommendations),
    actionables: parseArray<StrategyActionable>(row.actionables),
    analysis: analysis && typeof analysis === 'object' ? analysis : null,
    analysisFingerprint: row.analysis_fingerprint ? String(row.analysis_fingerprint) : null,
    analysisAt: toIso(row.analysis_at),
    previousFields: previous.length > 0 ? previous : null,
    previousReason: previous.length > 0 && row.previous_reason ? (String(row.previous_reason) as FieldChangeReason) : null,
    updatedAt: toIso(row.updated_at),
    version: Number(row.version ?? 0) || 0,
  };
}

const COLUMNS = `fields, recommendations, actionables, analysis, analysis_fingerprint, analysis_at,
            previous_fields, previous_reason, version, updated_at`;

/** Full saved record for one tool in one scope. Null if nothing has been saved for it yet. */
export async function getFillin(scope: FillinScope, toolId: string): Promise<FillinRecord | null> {
  await ensureDatabaseSchema();
  const [rows] = (await pool.query(
    `SELECT ${COLUMNS}
     FROM ws_fillins WHERE client_id = ? AND section = ? AND case_id = ? AND tool_id = ? LIMIT 1`,
    [scope.clientId, scope.section, scope.caseId, toolId]
  )) as [Record<string, unknown>[], unknown];
  if (!rows || rows.length === 0) return null;
  return rowToRecord(rows[0]);
}

/** Every tool saved in this scope — what the section overview and the connections panel read. */
export async function listFillins(scope: FillinScope): Promise<(FillinRecord & { toolId: string })[]> {
  await ensureDatabaseSchema();
  const [rows] = (await pool.query(
    `SELECT tool_id, ${COLUMNS}
     FROM ws_fillins WHERE client_id = ? AND section = ? AND case_id = ?`,
    [scope.clientId, scope.section, scope.caseId]
  )) as [Record<string, unknown>[], unknown];
  return (rows ?? []).map((row) => ({ toolId: String(row.tool_id), ...rowToRecord(row) }));
}

export interface SaveOptions {
  /** Set when `fields` changed in bulk (an AI fill, a template or document import): the previous fields are kept once so it can be undone. */
  snapshotReason?: FieldChangeReason;
}

/**
 * Partial save — updates only the keys provided, preserving whatever else was already stored (saving edited fields must not
 * wipe a previously generated analysis, and vice versa). Read-merge-write; a row is small enough that this stays simple.
 *
 * `analysis` is stored with the fingerprint of the fields it was written from, so a later change to the fields shows the
 * analysis as out of date (fillinStatus) instead of silently presenting it as current.
 */
export async function saveFillin(
  scope: FillinScope,
  toolId: string,
  updates: Partial<Pick<FillinRecord, 'fields' | 'recommendations' | 'actionables'>> & { analysis?: StrategyAnalysis | null },
  opts: SaveOptions = {}
): Promise<FillinRecord> {
  await ensureDatabaseSchema();
  const existing = (await getFillin(scope, toolId)) ?? EMPTY_RECORD;

  const fields = updates.fields ?? existing.fields;
  const fieldsChanged = updates.fields !== undefined && JSON.stringify(updates.fields.map((f) => [f.label, f.value])) !== JSON.stringify(existing.fields.map((f) => [f.label, f.value]));

  let previousFields = existing.previousFields;
  let previousReason = existing.previousReason;
  if (fieldsChanged) {
    if (opts.snapshotReason && existing.fields.some((f) => (f.value ?? '').trim())) {
      previousFields = existing.fields;
      previousReason = opts.snapshotReason;
    } else if (!opts.snapshotReason) {
      // A manual edit after an AI fill / import means the person has accepted it: the undo no longer applies.
      previousFields = null;
      previousReason = null;
    }
  }

  const analysis = updates.analysis !== undefined ? updates.analysis : existing.analysis;
  // The fingerprint is stamped only when the analysis is (re)written; otherwise it is carried as it was.
  const analysisFingerprint = updates.analysis !== undefined ? (updates.analysis ? fingerprintFields(fields) : null) : existing.analysisFingerprint;
  const analysisAt = updates.analysis !== undefined ? (updates.analysis ? new Date() : null) : existing.analysisAt ? new Date(existing.analysisAt) : null;

  await pool.query(
    `INSERT INTO ws_fillins
       (client_id, section, case_id, tool_id, fields, recommendations, actionables, analysis, analysis_fingerprint, analysis_at, previous_fields, previous_reason, version)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
     ON DUPLICATE KEY UPDATE
       fields = VALUES(fields), recommendations = VALUES(recommendations), actionables = VALUES(actionables),
       analysis = VALUES(analysis), analysis_fingerprint = VALUES(analysis_fingerprint), analysis_at = VALUES(analysis_at),
       previous_fields = VALUES(previous_fields), previous_reason = VALUES(previous_reason), version = version + 1, updated_at = CURRENT_TIMESTAMP`,
    [
      scope.clientId,
      scope.section,
      scope.caseId,
      toolId,
      JSON.stringify(fields),
      JSON.stringify(updates.recommendations ?? existing.recommendations),
      JSON.stringify(updates.actionables ?? existing.actionables),
      analysis ? JSON.stringify(analysis) : null,
      analysisFingerprint,
      analysisAt,
      previousFields ? JSON.stringify(previousFields) : null,
      previousFields ? previousReason : null,
    ]
  );
  const saved = await getFillin(scope, toolId);
  return saved ?? { ...EMPTY_RECORD, fields, previousFields, previousReason };
}

/** Back-compat narrow mutator — fields only (preserves any existing analysis/recommendations/actionables). */
export async function saveFillinFields(scope: FillinScope, toolId: string, fields: FrameworkField[]): Promise<void> {
  await saveFillin(scope, toolId, { fields });
}

/** Puts the fields back as they were before the last AI fill / import. Returns null when there is nothing to undo. */
export async function undoFieldChange(scope: FillinScope, toolId: string): Promise<FillinRecord | null> {
  const existing = await getFillin(scope, toolId);
  if (!existing?.previousFields) return null;
  await pool.query(
    `UPDATE ws_fillins SET fields = ?, previous_fields = NULL, previous_reason = NULL, version = version + 1, updated_at = CURRENT_TIMESTAMP
     WHERE client_id = ? AND section = ? AND case_id = ? AND tool_id = ?`,
    [JSON.stringify(existing.previousFields), scope.clientId, scope.section, scope.caseId, toolId]
  );
  return getFillin(scope, toolId);
}
