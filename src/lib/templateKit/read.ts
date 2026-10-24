/**
 * read.ts — reads a filled kit workbook back into values, tolerantly: it matches sheets, fields and columns by
 * their visible names (case/spacing/dash-insensitive), converts numbers and dropdown values the way people type
 * them, and reports anything it could not use as plain-language warnings instead of failing the whole file.
 *
 * Browser or Node; nothing here talks to a server.
 */
import { openWorkbook, type XlsxLoader } from '../sixSigma/ingest';
import { SAMPLE_MARKER } from '../demo/marker';
import { GUIDE_SHEET } from './workbook';
import { isBlank, matchOption, norm, splitMulti, toNumber, toYesNo } from './values';
import type { Cell, FieldsSheet, KitContent, KitDefinition, KitField, KitReadResult, TableSheet } from './types';

function readField(f: KitField, raw: unknown, sheet: string, warnings: string[]): Cell | null {
  const where = `${sheet} › ${f.label}`;
  switch (f.type ?? 'text') {
    case 'number': {
      const n = toNumber(raw);
      if (n === null) { warnings.push(`${where}: “${String(raw)}” is not a number — left blank.`); return null; }
      return n;
    }
    case 'select': {
      const m = matchOption(raw, f.options ?? []);
      if (m === null) { warnings.push(`${where}: “${String(raw)}” is not one of the allowed values — left blank.`); return null; }
      return m;
    }
    case 'multiselect': {
      const parts = splitMulti(raw);
      const kept: string[] = [];
      for (const p of parts) {
        const m = matchOption(p, f.options ?? []);
        if (m) { if (!kept.includes(m)) kept.push(m); } else warnings.push(`${where}: “${p}” is not one of the allowed values — skipped.`);
      }
      return kept.length ? kept.join(', ') : null;
    }
    case 'yesno': {
      const yn = toYesNo(raw);
      if (yn === null) { warnings.push(`${where}: “${String(raw)}” is not Yes or No — left blank.`); return null; }
      return yn;
    }
    default:
      return String(raw).trim();
  }
}

function readFieldsSheet(spec: FieldsSheet, rows: Record<string, unknown>[], headers: string[], warnings: string[]): Record<string, Cell> {
  const col = (name: string) => headers.find(h => norm(h) === norm(name));
  const fieldCol = col('Field'), valueCol = col('Value');
  const out: Record<string, Cell> = {};
  if (!fieldCol || !valueCol) { warnings.push(`Sheet “${spec.name}”: needs “Field” and “Value” columns — nothing read from it.`); return out; }
  const byLabel = new Map(spec.fields.map(f => [norm(f.label), f]));
  for (const row of rows) {
    const f = byLabel.get(norm(row[fieldCol]));
    if (!f || isBlank(row[valueCol])) continue;
    const v = readField(f, row[valueCol], spec.name, warnings);
    if (v !== null) out[f.key] = v;
  }
  return out;
}

function readTableSheet(spec: TableSheet, rows: Record<string, unknown>[], headers: string[], warnings: string[]): Record<string, Cell>[] {
  const colFor = new Map<string, string>(); // column key → header text actually used in the file
  for (const c of spec.columns) { const h = headers.find(x => norm(x) === norm(c.header)); if (h) colFor.set(c.key, h); }
  const missing = spec.columns.filter(c => c.required && !colFor.has(c.key));
  if (missing.length) warnings.push(`Sheet “${spec.name}”: missing column ${missing.map(c => `“${c.header}”`).join(', ')}.`);
  const out: Record<string, Cell>[] = [];
  rows.forEach((row, i) => {
    const item: Record<string, Cell> = {};
    for (const c of spec.columns) {
      const h = colFor.get(c.key);
      if (!h || isBlank(row[h])) continue;
      if (c.type === 'number') {
        const n = toNumber(row[h]);
        if (n === null) warnings.push(`${spec.name} row ${i + 2} › ${c.header}: “${String(row[h])}” is not a number — left blank.`);
        else item[c.key] = n;
      } else item[c.key] = String(row[h]).trim();
    }
    if (Object.keys(item).length) out.push(item);
  });
  return out;
}

/** Rows that carry data, not just the labels the blank template ships with (number columns; for text-only tables,
 * anything past the first column). */
function dataRowCount(spec: TableSheet, rows: Record<string, Cell>[]): number {
  const numeric = spec.columns.filter(c => c.type === 'number');
  const dataCols = (numeric.length ? numeric : spec.columns.slice(1)).map(c => c.key);
  return rows.filter(r => dataCols.some(k => r[k] !== undefined)).length;
}

/**
 * FUTURESKILZ: the workbook opener is injectable (references/06 §3), so a server route reads uploads with the vendored SheetJS
 * (templateKit/serverOpen.ts) while the browser and the tests keep the default.
 */
export async function readKitWorkbook(def: KitDefinition, data: ArrayBuffer | Uint8Array, loader?: XlsxLoader): Promise<KitReadResult> {
  const handle = await openWorkbook(data, { csv: false }, loader);
  const warnings: string[] = [];
  const content: KitContent = {};
  const bySheet = new Map(def.sheets.map(s => [norm(s.name), s]));
  const unknownSheets: string[] = [];
  let isSample = false;
  let filled = 0;

  for (const name of handle.sheetNames) {
    const loaded = handle.load(name);
    if (JSON.stringify(loaded).includes(SAMPLE_MARKER)) isSample = true;
    if (norm(name) === norm(GUIDE_SHEET)) continue;
    const spec = bySheet.get(norm(name));
    if (!spec) { unknownSheets.push(name); continue; }
    if (spec.kind === 'fields') {
      const values = readFieldsSheet(spec, loaded.rows, loaded.headers, warnings);
      content[spec.name] = values;
      filled += Object.keys(values).length;
    } else {
      const rows = readTableSheet(spec, loaded.rows, loaded.headers, warnings);
      content[spec.name] = rows;
      filled += dataRowCount(spec, rows);
    }
  }
  return { content, isSample, unknownSheets, warnings, filled };
}
