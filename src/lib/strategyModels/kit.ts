/**
 * strategyModels/kit.ts — the downloadable blank template, the sample workbook and the importer for ANY framework, generated
 * from its structure so they cannot disagree with the form on the page: the same elements, in the same order, under the same
 * names. It builds a KitDefinition for the shared template-kit library (src/lib/templateKit), which writes the workbook (with
 * its "How to fill" guide), reads a filled one back tolerantly, and recognises our own sample files by their marker.
 *
 * One sheet per section of single answers, and one sheet per table. Worked-out columns (a quadrant, a score) are not in the
 * template — the page calculates them.
 */
import type { Cell, FieldsSheet, KitContent, KitDefinition, KitField, KitSheet, TableColumn, TableSheet } from '../templateKit/types';
import { isBlank, matchOption, norm as kitNorm, toNumber } from '../templateKit/values';
import {
  cleanTable,
  fmtNum,
  labelColumnKey,
  typedColumns,
} from './values';
import {
  isField,
  isTable,
  type Column,
  type FieldPart,
  type ModelValues,
  type RatingScale,
  type Row,
  type Section,
  type Structure,
  type TablePart,
} from './types';

export interface KitSource {
  toolId: string;
  /** The framework's display name, e.g. "Porter's Five Forces". */
  name: string;
  /** Who published the model, if known — named in the guide. */
  originator?: string;
  structure: Structure;
}

export interface StrategyKit {
  def: KitDefinition;
  /** Answers → the workbook's cell values (what the sample and an export are built from). */
  toContent: (values: ModelValues) => KitContent;
  /**
   * A read workbook's cell values → answers; values the model does not allow are dropped, never guessed. Each choice or rating
   * dropped from a table is reported in plain words in `warnings` (the reader already reports bad numbers and bad single choices).
   */
  fromContent: (content: KitContent, warnings?: string[]) => ModelValues;
}

const SHEET_NAME_MAX = 31;

/** An Excel-legal, unique sheet name of at most 31 characters. */
export function safeSheetName(name: string, used: Set<string>): string {
  const base = name.replace(/[[\]:*?/\\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, SHEET_NAME_MAX).trim() || 'Sheet';
  let candidate = base;
  for (let i = 2; used.has(kitNorm(candidate)); i += 1) {
    const suffix = ` ${i}`;
    candidate = `${base.slice(0, SHEET_NAME_MAX - suffix.length).trim()}${suffix}`;
  }
  used.add(kitNorm(candidate));
  return candidate;
}

/** "Porter's Five Forces" → "Eccellere-Porters-Five-Forces". */
export function kitFileBase(name: string): string {
  const stem = name.replace(/['’]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `Eccellere-${stem || 'Strategy-Hub-Tool'}`;
}

const scaleOptions = (s: RatingScale | undefined): string[] => {
  const { min, max } = s ?? { min: 1, max: 5 };
  const out: string[] = [];
  for (let i = min; i <= max; i += 1) out.push(String(i));
  return out;
};

const scaleHelp = (s: RatingScale | undefined): string => {
  const sc = s ?? { min: 1, max: 5, low: 'low', high: 'high' };
  return `${sc.min} = ${sc.low} … ${sc.max} = ${sc.high}`;
};

function kitFieldFor(p: FieldPart, group: string): KitField {
  const base: KitField = { key: p.key, label: p.label, help: p.help, example: p.example || undefined, group };
  switch (p.type) {
    case 'select': return { ...base, type: 'select', options: p.options };
    case 'rating': return { ...base, type: 'select', options: scaleOptions(p.scale), help: `${p.help} (${scaleHelp(p.scale)})` };
    case 'number': return { ...base, type: 'number', help: p.unit ? `${p.help} (in ${p.unit})` : p.help };
    case 'longtext': return { ...base, type: 'longtext' };
    default: return { ...base, type: 'text' };
  }
}

function columnOptions(c: Column): readonly string[] | undefined {
  if (c.type === 'select') return c.options;
  if (c.type === 'rating') return scaleOptions(c.scale);
  return undefined;
}

function tableColumnFor(c: Column): TableColumn {
  const allowed = columnOptions(c);
  const extra = allowed ? ` Allowed: ${allowed.join(' · ')}.` : '';
  const unit = c.type === 'number' && c.unit ? ` (in ${c.unit})` : '';
  return { key: c.key, header: c.header, help: `${c.help}${unit}${extra}`, type: c.type === 'number' ? 'number' : 'text', width: c.type === 'longtext' ? 56 : c.type === 'number' ? 16 : 30 };
}

function fieldsSheetFor(sec: Section, parts: FieldPart[], name: string): FieldsSheet {
  return { kind: 'fields', name, summary: sec.summary || sec.title, fields: parts.map((p) => kitFieldFor(p, sec.title)) };
}

/** A read-only column beside a fixed table's row names: what to consider on that row. Shown in the template, never read back. */
const HINT_KEY = '_hint';
const HINT_COLUMN: TableColumn = { key: HINT_KEY, header: 'Consider', help: 'What to consider on this row. For reference only — it is not read back.', type: 'text', width: 54 };

function tableSheetFor(t: TablePart, name: string): TableSheet {
  const typed = typedColumns(t).map(tableColumnFor);
  const hinted = !!t.fixedRows && !!t.rowHints;
  const cols = hinted ? [typed[0], HINT_COLUMN, ...typed.slice(1)] : typed;
  const scaffold: Record<string, Cell>[] | undefined = t.fixedRows
    ? t.fixedRows.map((r) => ({ [labelColumnKey(t)]: r, ...(hinted ? { [HINT_KEY]: t.rowHints![r] ?? '' } : {}) }))
    : undefined;
  return { kind: 'table', name, summary: t.help, columns: cols, scaffold };
}

/** Where each part lives in the workbook, so values can be carried both ways. */
interface Placement { sheet: string; part: FieldPart | TablePart }

export function strategyKit(src: KitSource): StrategyKit {
  const used = new Set<string>();
  const sheets: KitSheet[] = [];
  const placements: Placement[] = [];
  let hasComputed = false;

  for (const sec of src.structure.sections) {
    const fieldParts = sec.parts.filter(isField);
    if (fieldParts.length > 0) {
      const name = safeSheetName(sec.title, used);
      sheets.push(fieldsSheetFor(sec, fieldParts, name));
      for (const p of fieldParts) placements.push({ sheet: name, part: p });
    }
    for (const p of sec.parts.filter(isTable)) {
      const name = safeSheetName(p.label, used);
      sheets.push(tableSheetFor(p, name));
      placements.push({ sheet: name, part: p });
      if (p.columns.some((c) => c.type === 'computed')) hasComputed = true;
    }
  }

  const guidance = [
    `This template follows the ${src.name} model${src.originator ? ` (${src.originator})` : ''} — the same elements, in the same order, as the guided form on its Strategy Hub page.`,
    'Fill what you know and leave the rest blank. Upload the file on the tool’s page and your answers appear in the form; anything you had typed there stays unless the file has a value for it.',
    ...(hasComputed ? ['Figures the model works out for you (a quadrant, a score, a total) are calculated on the page — you do not enter them here.'] : []),
    ...(sheets.some((s) => s.kind === 'table') ? ['A table sheet takes one row per item; leave unused rows empty. Where a column lists allowed values, pick one of them.'] : []),
  ];

  const def: KitDefinition = {
    id: `strategy-${src.toolId}`,
    title: `Eccellere Strategy Hub — ${src.name}`,
    breadcrumb: `Strategy Hub › ${src.name}`,
    guidance,
    sheets,
    fileBase: kitFileBase(src.name),
  };

  const toCell = (type: string, v: string): Cell => {
    if (type === 'number') { const n = toNumber(v); return n === null ? v : n; }
    return v;
  };

  const toContent = (values: ModelValues): KitContent => {
    const content: KitContent = {};
    for (const s of sheets) content[s.name] = s.kind === 'fields' ? {} : [];
    for (const { sheet, part } of placements) {
      if (isField(part)) {
        const v = values.fields[part.key];
        if (!isBlank(v)) (content[sheet] as Record<string, Cell>)[part.key] = toCell(part.type, v!.trim());
      } else {
        const rows = cleanTable(part, values.tables[part.key]);
        const key = labelColumnKey(part);
        // A fixed table lists every one of its rows (so the sample shows the model's own rows and their hints), data merged in.
        const listed = part.fixedRows
          ? part.fixedRows.map((name) => ({ ...(rows.find((r) => kitNorm(r[key]) === kitNorm(name)) ?? {}), [key]: name }))
          : rows;
        (content[sheet] as Record<string, Cell>[]).push(
          ...listed.map((r) => ({
            ...Object.fromEntries(typedColumns(part).filter((c) => !isBlank(r[c.key])).map((c) => [c.key, toCell(c.type, r[c.key])])),
            ...(part.fixedRows && part.rowHints ? { [HINT_KEY]: part.rowHints[r[key]] ?? '' } : {}),
          }) as Record<string, Cell>)
        );
      }
    }
    return content;
  };

  const fromContent = (content: KitContent, warnings?: string[]): ModelValues => {
    const values: ModelValues = { fields: {}, tables: {} };
    for (const { sheet, part } of placements) {
      const given = content[sheet];
      if (!given) continue;
      if (isField(part)) {
        const raw = (given as Record<string, Cell>)[part.key];
        if (raw === undefined || isBlank(raw)) continue;
        const v = readValue(part.type, raw, part.type === 'select' ? part.options : part.type === 'rating' ? scaleOptions(part.scale) : undefined);
        if (v) values.fields[part.key] = v;
      } else {
        const rows: Row[] = [];
        const nameKey = labelColumnKey(part);
        (given as Record<string, Cell>[]).forEach((r, i) => {
          const row: Row = {};
          for (const c of typedColumns(part)) {
            const raw = r[c.key];
            if (raw === undefined || isBlank(raw)) continue;
            const v = readValue(c.type, raw, columnOptions(c));
            if (v) row[c.key] = v;
            else if (columnOptions(c)) warnings?.push(`${sheet} › ${part.fixedRows ? String(r[nameKey] ?? `row ${i + 1}`) : `row ${i + 1}`} › ${c.header}: “${String(raw)}” is not one of the allowed values — left blank.`);
          }
          if (Object.keys(row).length > 0) rows.push(row);
        });
        const cleaned = alignToFixed(part, rows);
        if (cleaned.length > 0) values.tables[part.key] = cleaned;
      }
    }
    return values;
  };

  return { def, toContent, fromContent };
}

/** A cell's value as the model's text: numbers tidied, select/rating values matched to the allowed ones (else dropped). */
function readValue(type: string, raw: Cell, options?: readonly string[]): string {
  if (type === 'number') { const n = toNumber(raw); return n === null ? '' : fmtNum(n, 4); }
  if (options) return matchOption(raw, options) ?? '';
  return String(raw).trim();
}

/** For a table whose rows are the model's own, rows are matched to them by name; any other name is ignored. */
function alignToFixed(t: TablePart, rows: Row[]): Row[] {
  if (!t.fixedRows) return cleanTable(t, rows);
  const key = labelColumnKey(t);
  const byName = new Map(t.fixedRows.map((n) => [kitNorm(n), n]));
  const out: Row[] = [];
  for (const r of rows) {
    const name = byName.get(kitNorm(r[key]));
    if (name) out.push({ ...r, [key]: name });
  }
  return cleanTable(t, out);
}
