/**
 * strategyFrameworks.ts — the catalogue of a framework workspace section (the ws_tools table, references/05 §5).
 *
 * FUTURESKILZ ADAPTATION of the Eccellere Strategy Hub file (commit f9c3ab4). The hub keeps 36 strategy frameworks in its
 * own strategy_frameworks table with hub-only facets (layer, phase). A workspace section keeps its tools in ws_tools,
 * shared by every section and keyed by (section, tool_id), with the section's own facets (Problem Solving: stage, fits,
 * nature). The file and type names are kept so the copied engine (AI prompts, methodology, connections) compiles unchanged:
 * `layer` now carries the tool's STAGE.
 *
 * Tools defined in code are seeded from the section's seed list (ensureSectionToolsSeeded): an idempotent upsert that
 * never overwrites an admin's later edit of a row, run once per process. A tool with a model always shows the model's own
 * fields, whatever the row says.
 */

import pool from './mysql';
import { ensureDatabaseSchema } from '../server/db/ensure-schema';
import { getModelDefinition } from './strategyModels/registry';
import { flattenStructure } from './strategyModels/values';
import { effectiveLinks, type LinkRow, type Links } from './strategyFrameworkLinks';

export type FrameworkStatus = 'draft' | 'needs_review' | 'in_review' | 'published' | 'deprecated';

export interface FrameworkField {
  label: string;
  value: string;
  source: string;
  /** Optional additional worked examples beyond `value`. */
  examples?: string[];
}

/** The section's own filters for a tool, e.g. {stage: 'Define', fits: ['Q','D'], nature: 'diagnostic'}. */
export interface ToolFacets {
  stage: string;
  nature: string;
  fits?: string[];
  category?: string;
  [k: string]: unknown;
}

export interface StrategyFrameworkRow {
  id: number;
  section: string;
  toolId: string;
  name: string;
  /** The tool's stage (kept under the hub's name `layer` so the copied prompts read it). */
  layer: string;
  nature: string;
  facets: ToolFacets;
  does: string;
  whenToUse: string;
  whenNotToUse?: string;
  evidenceRequirements?: string;
  scoringGuidance?: string;
  reportTemplate?: string;
  nextStep: string;
  fields: FrameworkField[];
  upstreamTools: string[];
  downstreamTools: string[];
  status: FrameworkStatus;
  sortOrder: number;
  /** True when the tool has a model in code: its fields are the model's own and are managed in code. */
  hasModel?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type StrategyFrameworkSummary = Pick<
  StrategyFrameworkRow,
  'id' | 'toolId' | 'name' | 'layer' | 'nature' | 'facets' | 'status' | 'sortOrder' | 'updatedAt'
>;

/** One code-defined tool of a section, as its seed declares it. */
export interface SeedTool {
  toolId: string;
  name: string;
  facets: ToolFacets;
  does: string;
  whenToUse: string;
  whenNotToUse: string;
  nextStep: string;
  upstreamTools: string[];
  downstreamTools: string[];
  status: FrameworkStatus;
  sortOrder: number;
}

/**
 * Pure completeness check gating any move toward `published`, enforced on the server. Checks that each piece is PRESENT
 * and that the golden thread is declared — never a character count.
 */
export function publishBlockers(framework: Pick<StrategyFrameworkRow, 'name' | 'does' | 'whenToUse' | 'nextStep' | 'fields'>): string[] {
  const blockers: string[] = [];
  if (!framework.name?.trim()) blockers.push('Framework name is empty.');
  if (!framework.does?.trim()) blockers.push('"What this does" is empty.');
  if (!framework.whenToUse?.trim()) blockers.push('"When to use it" is empty.');
  if (!framework.nextStep?.trim()) blockers.push('"What happens next" is empty — every published framework must declare the golden thread it feeds.');
  const usableFields = (framework.fields ?? []).filter((f) => f?.label?.trim());
  if (usableFields.length === 0) {
    blockers.push('Add at least one guided fill-in field.');
  } else {
    const unlabelledValues = usableFields.filter((f) => !f.value?.trim());
    if (unlabelledValues.length > 0) {
      blockers.push(`${unlabelledValues.length} field(s) have no illustrative example value: ${unlabelledValues.map((f) => `"${f.label}"`).join(', ')}.`);
    }
  }
  return blockers;
}

function parseJsonMaybe<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value !== 'string') return value as T;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function rowToFramework(row: Record<string, unknown>): StrategyFrameworkRow {
  const model = getModelDefinition(row.tool_id as string);
  const facets = parseJsonMaybe<ToolFacets>(row.facets, { stage: '', nature: '' });
  return {
    id: Number(row.id),
    section: String(row.section),
    toolId: String(row.tool_id),
    name: String(row.name),
    layer: String(facets.stage ?? ''),
    nature: String(facets.nature ?? ''),
    facets,
    does: (row.does as string) ?? '',
    whenToUse: (row.when_to_use as string) ?? '',
    whenNotToUse: (row.when_not_to_use as string) ?? '',
    nextStep: (row.next_step as string) ?? '',
    fields: model ? flattenStructure(model) : parseJsonMaybe<FrameworkField[]>(row.fields, []),
    hasModel: !!model,
    upstreamTools: parseJsonMaybe<string[]>(row.upstream_tools, []),
    downstreamTools: parseJsonMaybe<string[]>(row.downstream_tools, []),
    status: row.status as FrameworkStatus,
    sortOrder: Number(row.sort_order ?? 0),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

const seeded = new Map<string, Promise<void>>();

/**
 * Upserts the section's code-defined tools once per process. A new tool is inserted; an existing row only has its EMPTY
 * text columns back-filled, so an admin's edit is never overwritten. The model's fields are written for reference.
 */
export function ensureSectionToolsSeeded(section: string, tools: readonly SeedTool[]): Promise<void> {
  const key = `${section}:${tools.map((t) => t.toolId).join(',')}`;
  let run = seeded.get(key);
  if (!run) {
    run = (async () => {
      await ensureDatabaseSchema();
      for (const t of tools) {
        const model = getModelDefinition(t.toolId);
        const fields = model ? flattenStructure(model) : [];
        await pool.query(
          `INSERT INTO ws_tools (section, tool_id, name, facets, does, when_to_use, when_not_to_use, next_step, fields, upstream_tools, downstream_tools, status, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             does = IF(does IS NULL OR does = '', VALUES(does), does),
             when_to_use = IF(when_to_use IS NULL OR when_to_use = '', VALUES(when_to_use), when_to_use),
             when_not_to_use = IF(when_not_to_use IS NULL OR when_not_to_use = '', VALUES(when_not_to_use), when_not_to_use),
             next_step = IF(next_step IS NULL OR next_step = '', VALUES(next_step), next_step),
             fields = VALUES(fields)`,
          [
            section, t.toolId, t.name, JSON.stringify(t.facets), t.does, t.whenToUse, t.whenNotToUse, t.nextStep,
            JSON.stringify(fields), JSON.stringify(t.upstreamTools), JSON.stringify(t.downstreamTools), t.status, t.sortOrder,
          ]
        );
      }
    })().catch((error: unknown) => {
      seeded.delete(key);
      throw error;
    });
    seeded.set(key, run);
  }
  return run;
}

export async function listStrategyFrameworks(section: string, filters: { status?: FrameworkStatus } = {}): Promise<StrategyFrameworkSummary[]> {
  await ensureDatabaseSchema();
  const params: string[] = [section];
  let where = 'WHERE section = ?';
  if (filters.status) { where += ' AND status = ?'; params.push(filters.status); }
  const [rows] = (await pool.query(
    `SELECT id, tool_id, name, facets, status, sort_order, updated_at FROM ws_tools ${where} ORDER BY sort_order ASC, name ASC`,
    params
  )) as [Record<string, unknown>[], unknown];
  return rows.map((row) => {
    const facets = parseJsonMaybe<ToolFacets>(row.facets, { stage: '', nature: '' });
    return {
      id: Number(row.id),
      toolId: String(row.tool_id),
      name: String(row.name),
      layer: String(facets.stage ?? ''),
      nature: String(facets.nature ?? ''),
      facets,
      status: row.status as FrameworkStatus,
      sortOrder: Number(row.sort_order ?? 0),
      updatedAt: String(row.updated_at),
    };
  });
}

export async function getStrategyFrameworkByToolId(section: string, toolId: string): Promise<StrategyFrameworkRow | null> {
  await ensureDatabaseSchema();
  const [rows] = (await pool.query('SELECT * FROM ws_tools WHERE section = ? AND tool_id = ? LIMIT 1', [section, toolId])) as [
    Record<string, unknown>[],
    unknown,
  ];
  if (!rows || rows.length === 0) return null;
  return rowToFramework(rows[0]);
}

/** Every tool's declared links in the section, for building the two-way golden thread. */
export async function listLinkRows(section: string): Promise<LinkRow[]> {
  await ensureDatabaseSchema();
  const [rows] = (await pool.query('SELECT tool_id, upstream_tools, downstream_tools FROM ws_tools WHERE section = ?', [section])) as [
    Record<string, unknown>[],
    unknown,
  ];
  return rows.map((r) => ({
    toolId: r.tool_id as string,
    upstreamTools: parseJsonMaybe<string[]>(r.upstream_tools, []),
    downstreamTools: parseJsonMaybe<string[]>(r.downstream_tools, []),
  }));
}

/** The tools that feed this one and the tools it feeds, counting a link declared on either side. */
export async function getEffectiveLinks(section: string, toolId: string): Promise<Links> {
  return effectiveLinks(await listLinkRows(section)).get(toolId) ?? { upstream: [], downstream: [] };
}
