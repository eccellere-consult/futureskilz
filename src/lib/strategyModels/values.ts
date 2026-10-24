/**
 * strategyModels/values.ts — everything that turns a model's structure and a client's answers into one another, with no
 * database, no AI and no React:
 *
 *   • the flat saved shape (FrameworkField[], matched by label — how strategy_fillins stores it) ⇄ ModelValues,
 *     including a table's rows (kept as JSON in the one saved value) and answers saved under an older label,
 *   • blank / completeness rules, so "has the client answered this?" means the same everywhere,
 *   • the figures a model works out (computed columns, "results at a glance") and the outputs other tools take as input,
 *   • the readable rendering of the answers that goes into an AI prompt.
 */
import type { FrameworkField } from '../strategyFrameworks';
import { isBlank, matchOption, toNumber } from '../templateKit/values';
import {
  isField,
  isTable,
  type Column,
  type FieldPart,
  type ModelValues,
  type Part,
  type Prefill,
  type Row,
  type Structure,
  type TablePart,
  type Tone,
} from './types';

/** The catch-all field some models carry: old answers with no exact home are kept here. */
export const NOTES_KEY = 'notes';

export const norm = (s: unknown): string => String(s ?? '').toLowerCase().replace(/\s+/g, ' ').trim();

/** Tolerant number reading ("₹1,25,000", "12.5%", "(40)"); null when it is not a number. */
export const toNum = (s: unknown): number | null => toNumber(s);

/** A number as short text: no trailing zeros, at most `decimals` places. */
export function fmtNum(n: number, decimals = 1): string {
  if (!Number.isFinite(n)) return '';
  return String(Number(n.toFixed(decimals)));
}

// ── Walking a structure ──────────────────────────────────────────────────────

export const partsOf = (s: Pick<Structure, 'sections'>): Part[] => s.sections.flatMap((sec) => sec.parts);
export const findPart = (s: Pick<Structure, 'sections'>, key: string): Part | undefined => partsOf(s).find((p) => p.key === key);
export const fieldPartsOf = (s: Pick<Structure, 'sections'>): FieldPart[] => partsOf(s).filter(isField);
export const tablePartsOf = (s: Pick<Structure, 'sections'>): TablePart[] => partsOf(s).filter(isTable);

/** The columns a client types into (everything but computed ones). */
export const typedColumns = (t: TablePart): Column[] => t.columns.filter((c) => c.type !== 'computed');

/** For a fixed-rows table, the key of the first column, which holds the row's own name. */
export const labelColumnKey = (t: TablePart): string => t.columns[0].key;

// ── Rows ─────────────────────────────────────────────────────────────────────

export function parseRows(json: unknown): Row[] {
  if (typeof json !== 'string' || !json.trim()) return [];
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((r): r is Record<string, unknown> => !!r && typeof r === 'object' && !Array.isArray(r))
      .map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v === null || v === undefined ? '' : String(v)])));
  } catch {
    return [];
  }
}

/** The cells a client actually typed in a row (computed columns and a fixed row's own name do not count). */
function dataCells(t: TablePart, row: Row): string[] {
  const cols = typedColumns(t).filter((c, i) => !(t.fixedRows && i === 0));
  return cols.map((c) => (row[c.key] ?? '').trim()).filter(Boolean);
}

export const isBlankRow = (t: TablePart, row: Row): boolean => dataCells(t, row).length === 0;
export const isBlankTable = (t: TablePart, rows: readonly Row[] | undefined): boolean => !rows || rows.every((r) => isBlankRow(t, r));

/**
 * A row as it is saved: only typed columns, in column order, trimmed, with empty cells left out — so the same answers
 * always serialise to the same text (and so to the same fingerprint).
 */
export function normaliseRow(t: TablePart, row: Row): Row {
  const out: Row = {};
  for (const c of typedColumns(t)) {
    const v = (row[c.key] ?? '').trim();
    if (v) out[c.key] = v;
  }
  return out;
}

/** The rows worth saving: those with data, normalised, capped at the table's maximum. A fixed row keeps its own name. */
export function cleanTable(t: TablePart, rows: readonly Row[] | undefined): Row[] {
  const out: Row[] = [];
  for (const r of rows ?? []) {
    if (isBlankRow(t, r)) continue;
    const n = normaliseRow(t, r);
    if (t.fixedRows) n[labelColumnKey(t)] = (r[labelColumnKey(t)] ?? '').trim();
    out.push(n);
  }
  return out.slice(0, t.maxRows);
}

/** The rows the form shows: a fixed table lists every one of its rows (data merged in by name); a free table pads to `minRows`. */
export function expandTable(t: TablePart, rows: readonly Row[] | undefined): Row[] {
  if (t.fixedRows) {
    const byName = new Map((rows ?? []).map((r) => [norm(r[labelColumnKey(t)]), r]));
    return t.fixedRows.map((name) => ({ ...(byName.get(norm(name)) ?? {}), [labelColumnKey(t)]: name }));
  }
  const out = (rows ?? []).map((r) => ({ ...r }));
  while (out.length < t.minRows) out.push({});
  return out.slice(0, t.maxRows);
}

// ── Blank / completeness ─────────────────────────────────────────────────────

/** Has the client answered this part? `value` is the part's saved text (a table's is its rows as JSON). */
export function isBlankSaved(part: Part, value: string | undefined): boolean {
  if (isBlank(value)) return true;
  return isTable(part) ? isBlankTable(part, parseRows(value)) : false;
}

export function completeness(s: Pick<Structure, 'sections'>, v: ModelValues): { filled: number; total: number } {
  const parts = partsOf(s);
  const filled = parts.filter((p) => (isField(p) ? !isBlank(v.fields[p.key]) : !isBlankTable(p, v.tables[p.key]))).length;
  return { filled, total: parts.length };
}

// ── Saved shape ⇄ values ─────────────────────────────────────────────────────

/** How a part's source shows to the client when nothing has been entered yet ("AI can draw this from your …"). */
export function prefillLabel(prefill: Prefill | undefined, nameOf?: (toolId: string) => string): string {
  if (!prefill) return 'Manual';
  if (prefill === 'business_context') return 'Business Context';
  if (prefill === 'value_scan') return 'Value Scan';
  return `upstream: ${nameOf ? nameOf(prefill.upstream) : prefill.upstream}`;
}

/** The part's illustrative placeholder as one line of text (a table's is its example row). */
export function exampleText(part: Part): string {
  if (isField(part)) return part.example;
  if (!part.exampleRow) return '';
  return typedColumns(part).map((c) => part.exampleRow![c.key]).filter(Boolean).join(' · ');
}

/**
 * The structure as the catalogue's flat field list: one entry per part, its label and its illustrative example (`value` is
 * an EXAMPLE in the catalogue, never an answer). This is what the admin screens, the public catalogue route and the default
 * methodology see for a framework that has a model.
 */
export function flattenStructure(s: Pick<Structure, 'sections'>, nameOf?: (toolId: string) => string): FrameworkField[] {
  return partsOf(s).map((p) => ({ label: p.label, value: exampleText(p), source: prefillLabel(p.kind === 'field' ? p.prefill : undefined, nameOf) }));
}

export interface ParsedFields {
  values: ModelValues;
  /** part key → the source badge it was saved with (Manual / AI / Template / Document / …). */
  sources: Record<string, string>;
  /** Saved fields that match no part — kept, never silently dropped (e.g. an old label nothing maps to). */
  unmatched: FrameworkField[];
}

/**
 * Where an answer saved under an older label now belongs: a part ("context"), or one cell of a table — of the model's own rows
 * ("activities#Operations.cost" = the "cost" column of the row named "Operations"), or of free rows by position
 * ("metrics#2.metric" = the "metric" column of the second row).
 */
export interface LegacyTarget { key: string; row?: string; col?: string }

export function parseLegacyTarget(target: string): LegacyTarget {
  const hash = target.indexOf('#');
  if (hash < 0) return { key: target };
  const key = target.slice(0, hash);
  const rest = target.slice(hash + 1);
  const dot = rest.lastIndexOf('.');
  return dot < 0 ? { key } : { key, row: rest.slice(0, dot), col: rest.slice(dot + 1) };
}

/**
 * An old answer as the text a typed element accepts — a choice must be one of its options, a rating a whole number on its scale,
 * a number a number — or null when it is not one. Such an answer is then kept visible beside the form instead of being forced
 * into an element that cannot hold it.
 */
export function coerceTyped(type: FieldPart['type'] | Column['type'], raw: string, options?: readonly string[], scale?: { min: number; max: number }): string | null {
  const v = raw.trim();
  if (type === 'select') return options ? matchOption(v, options) : null;
  if (type === 'rating') {
    const n = Number(v.match(/^(\d+)\b/)?.[1]);
    return scale && Number.isInteger(n) && n >= scale.min && n <= scale.max ? String(n) : null;
  }
  if (type === 'number') { const n = toNum(v); return n === null ? null : fmtNum(n, 4); }
  return v;
}

export function valuesFromFields(
  s: Pick<Structure, 'sections'> & { legacyLabels?: Record<string, string> },
  fields: readonly FrameworkField[]
): ParsedFields {
  const parts = partsOf(s);
  const byLabel = new Map(parts.map((p) => [norm(p.label), p]));
  const byKey = new Map(parts.map((p) => [p.key, p]));
  const legacy = new Map(Object.entries(s.legacyLabels ?? {}).map(([label, target]) => [norm(label), parseLegacyTarget(target)]));

  const values: ModelValues = { fields: {}, tables: {} };
  const sources: Record<string, string> = {};
  const unmatched: FrameworkField[] = [];
  const direct = new Set<string>();

  // Answers saved under the part's own label first; older labels only fill a part that has no answer of its own. A choice or a
  // rating can only hold one of its allowed values, so an older answer under the same label that is not one is kept visible
  // beside the form instead (numbers and text are kept as typed).
  for (const f of fields) {
    const part = byLabel.get(norm(f.label));
    if (!part) continue;
    if (isField(part) && (part.type === 'select' || part.type === 'rating') && !isBlank(f.value)) {
      const typed = coerceTyped(part.type, f.value, part.options, part.scale);
      if (typed === null) { unmatched.push(f); continue; }
      direct.add(part.key);
      assign(values, sources, part, { ...f, value: typed });
      continue;
    }
    direct.add(part.key);
    assign(values, sources, part, f);
  }
  const merged = new Set<string>();
  const celled = new Set<string>();
  for (const f of fields) {
    if (byLabel.has(norm(f.label))) continue;
    const target = legacy.get(norm(f.label));
    const part = target ? byKey.get(target.key) : undefined;
    if (!target || !part || isBlank(f.value)) {
      if (!isBlank(f.value)) unmatched.push(f);
      continue;
    }

    // One cell of a table of free rows, by position ("the second row") — only an empty cell, with a value that cell accepts.
    if (target.row !== undefined && target.col !== undefined && isTable(part) && !part.fixedRows) {
      const position = /^\d+$/.test(target.row) ? Number(target.row) : 0;
      const column = part.columns.find((c) => c.key === target.col);
      const value = column && column.type !== 'computed' ? coerceTyped(column.type, f.value, column.options, column.scale) : null;
      if (!column || value === null || position < 1 || position > part.maxRows) { unmatched.push(f); continue; }
      const rows = (values.tables[part.key] ??= []);
      while (rows.length < position) rows.push({});
      if ((rows[position - 1][column.key] ?? '').trim()) { unmatched.push(f); continue; }
      rows[position - 1][column.key] = value;
      sources[part.key] ??= f.source || 'Manual';
      continue;
    }

    // One cell of a table of the model's own rows — only an empty cell, and only with a value that cell accepts.
    if (target.row !== undefined && target.col !== undefined) {
      const column = isTable(part) && part.fixedRows ? part.columns.find((c) => c.key === target.col) : undefined;
      const rowName = isTable(part) ? part.fixedRows?.find((n) => norm(n) === norm(target.row)) : undefined;
      const value = column && rowName && column.type !== 'computed' ? coerceTyped(column.type, f.value, column.options, column.scale) : null;
      if (!isTable(part) || !column || !rowName || value === null) { unmatched.push(f); continue; }
      const labelKey = labelColumnKey(part);
      const rows = (values.tables[part.key] ??= []);
      let row = rows.find((r) => norm(r[labelKey]) === norm(rowName));
      if (row && (row[column.key] ?? '').trim()) { unmatched.push(f); continue; }
      if (!row) { row = { [labelKey]: rowName }; rows.push(row); }
      row[column.key] = value;
      sources[part.key] ??= f.source || 'Manual';
      celled.add(part.key);
      continue;
    }

    // An old answer with no exact home goes to the model's catch-all "notes" field, under its old label, so nothing is lost
    // and several of them sit together there.
    if (part.key === NOTES_KEY && isField(part)) {
      const line = `${f.label}: ${f.value.trim()}`;
      values.fields[part.key] = merged.has(part.key) ? `${values.fields[part.key]}\n${line}` : line;
      sources[part.key] = f.source || 'Manual';
      merged.add(part.key);
    } else if (!direct.has(part.key)) {
      let answer = f;
      if (isField(part)) {
        const typed = coerceTyped(part.type, f.value, part.options, part.scale);
        if (typed === null) { unmatched.push(f); continue; }
        answer = { ...f, value: typed };
      }
      assign(values, sources, part, answer);
      direct.add(part.key);
    } else {
      unmatched.push(f);
    }
  }
  // Rows added from old answers come out in the model's own order.
  for (const key of celled) {
    const part = byKey.get(key);
    if (part && isTable(part) && part.fixedRows) {
      const order = part.fixedRows.map(norm);
      const labelKey = labelColumnKey(part);
      values.tables[key].sort((a, b) => order.indexOf(norm(a[labelKey])) - order.indexOf(norm(b[labelKey])));
    }
  }
  return { values, sources, unmatched };
}

function assign(values: ModelValues, sources: Record<string, string>, part: Part, f: FrameworkField): void {
  if (isField(part)) {
    if (!isBlank(f.value)) values.fields[part.key] = f.value;
  } else {
    const rows = parseRows(f.value);
    if (!isBlankTable(part, rows)) values.tables[part.key] = rows;
  }
  if (!isBlankSaved(part, f.value)) sources[part.key] = f.source || 'Manual';
}

/** The saved list for a structure: every part, in order, with the client's answer (or a blank) and its source badge. */
export function fieldsFromValues(
  s: Pick<Structure, 'sections'>,
  values: ModelValues,
  sources: Record<string, string> = {}
): FrameworkField[] {
  return partsOf(s).map((p) => {
    if (isField(p)) return { label: p.label, value: values.fields[p.key] ?? '', source: sources[p.key] || 'Manual' };
    const rows = cleanTable(p, values.tables[p.key]);
    return { label: p.label, value: rows.length ? JSON.stringify(rows) : '', source: sources[p.key] || 'Manual' };
  });
}

// ── Computed figures ─────────────────────────────────────────────────────────

export function evalColumn(col: Column, row: Row, v: ModelValues): string {
  if (col.type !== 'computed' || !col.compute) return row[col.key] ?? '';
  try {
    return col.compute(row, v) ?? '';
  } catch {
    return '';
  }
}

export interface DerivedResult { key: string; label: string; help?: string; value: string | null; tone?: Tone }

export function computeDerived(s: Pick<Structure, 'derived'>, v: ModelValues): DerivedResult[] {
  return s.derived.map((d) => {
    let value: string | null = null;
    let tone: Tone | undefined;
    try {
      value = d.compute(v);
      tone = value === null ? undefined : d.tone?.(v);
    } catch {
      value = null;
    }
    return { key: d.key, label: d.label, help: d.help, value, tone };
  });
}

export interface ViewResult {
  key: string;
  title: string;
  help?: string;
  rowHeading: string;
  columns: readonly string[];
  rows: { name: string; strong: boolean; cells: string[] }[];
  /** True once at least one figure could be worked out. */
  hasFigures: boolean;
}

/** The model's tables of worked-out figures for the answers so far. A figure that cannot be worked out is an empty cell. */
export function computeViews(s: Pick<Structure, 'views'>, v: ModelValues): ViewResult[] {
  return (s.views ?? []).map((view) => {
    const strong = new Set(view.strong ?? []);
    const rows = view.rows.map((name) => ({
      name,
      strong: strong.has(name),
      cells: view.columns.map((c) => { try { return view.cell(name, c, v) ?? ''; } catch { return ''; } }),
    }));
    return { key: view.key, title: view.title, help: view.help, rowHeading: view.rowHeading, columns: view.columns, rows, hasFigures: rows.some((r) => r.cells.some((c) => c !== '')) };
  });
}

export interface OutputResult { key: string; label: string; value: string }

/** The named results this model currently produces, for tools that build on it. Only those with a value. */
export function computeOutputs(s: Pick<Structure, 'outputs'>, v: ModelValues): OutputResult[] {
  const out: OutputResult[] = [];
  for (const o of s.outputs) {
    try {
      const value = o.compute(v);
      if (value && value.trim()) out.push({ key: o.key, label: o.label, value: value.trim() });
    } catch {
      // an output that cannot be computed from partial answers is simply absent
    }
  }
  return out;
}

// ── For the AI ───────────────────────────────────────────────────────────────

const cell = (s: string): string => s.replace(/\|/g, '/').replace(/\s*\n\s*/g, ' ').trim();

/**
 * The answers as readable text for a prompt: each section, each answer (or "(left blank)"), each table as rows with its
 * computed columns evaluated, then the figures the model works out. Nothing is truncated. With `skipBlank`, only what has
 * been answered is listed (and the worked-out figures only if `includeDerived`) — used to show the AI what the client has
 * already given.
 */
export function renderValuesForPrompt(s: Structure, v: ModelValues, opts: { skipBlank?: boolean; includeDerived?: boolean } = {}): string {
  const lines: string[] = [];
  for (const sec of s.sections) {
    const body: string[] = [];
    for (const p of sec.parts) {
      if (isField(p)) {
        const val = v.fields[p.key];
        if (isBlank(val)) { if (!opts.skipBlank) body.push(`- ${p.label}: (left blank)`); continue; }
        body.push(`- ${p.label}: ${val!.trim()}`);
      } else {
        const rows = expandTable(p, v.tables[p.key]).filter((r) => !isBlankRow(p, r));
        if (rows.length === 0) { if (!opts.skipBlank) body.push(`- ${p.label}: (no rows entered)`); continue; }
        body.push(`- ${p.label}:`);
        body.push(`  | ${p.columns.map((c) => c.header).join(' | ')} |`);
        for (const r of rows) body.push(`  | ${p.columns.map((c) => cell(evalColumn(c, r, v)) || '—').join(' | ')} |`);
      }
    }
    if (body.length > 0) lines.push(`## ${sec.title}`, ...body);
  }
  if (opts.includeDerived ?? !opts.skipBlank) {
    const results = computeDerived(s, v).filter((d) => d.value !== null);
    if (results.length > 0) {
      lines.push('## Figures worked out from these answers');
      for (const d of results) lines.push(`- ${d.label}: ${d.value}`);
    }
    // Tables of worked-out figures (statements, projections), as the AI should read them: the client's own answers already
    // went through the model's arithmetic, so it need not — and must not — redo it.
    for (const view of computeViews(s, v).filter((x) => x.hasFigures)) {
      lines.push(`## ${view.title} (worked out from these answers)`);
      lines.push(`| ${[view.rowHeading, ...view.columns].join(' | ')} |`);
      for (const r of view.rows) lines.push(`| ${[r.strong ? `**${cell(r.name)}**` : cell(r.name), ...r.cells.map((c) => cell(c) || '—')].join(' | ')} |`);
    }
  }
  return lines.join('\n');
}
