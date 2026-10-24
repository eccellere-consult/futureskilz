/* eslint-disable @typescript-eslint/no-explicit-any -- spreadsheet cells are untyped by nature */
/**
 * ingest.ts — open an uploaded workbook (.xlsx / .xls / .csv) for the Measure stage's baseline-data upload.
 * Deliberately much simpler than Spend Analysis's / Process Improvement's readFile.ts: there is no fixed field
 * schema here (the user just picks ANY column as "category" and any column as a count/value), so there is
 * nothing to auto-map — just headers and rows. Shares the lazy xlsx-js-style loader with those two features
 * rather than a third copy.
 */
import { loadXlsx } from '../spendAnalysis/xlsxLoader';

export type RawRow = Record<string, any>;
export interface SheetData { headers: string[]; rows: RawRow[] }
export interface WorkbookHandle { sheetNames: string[]; best: string; load: (sheet: string) => SheetData }

const isRealHeader = (h: string) => !!h && !h.startsWith('__EMPTY');

export async function openWorkbook(data: ArrayBuffer | Uint8Array, opts: { csv?: boolean } = {}): Promise<WorkbookHandle> {
  const XLSX = await loadXlsx();
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  // CSV: raw:true stops SheetJS re-interpreting text such as 01/04/2025 as a US-order date.
  const wb = XLSX.read(bytes, { type: 'array', cellDates: false, ...(opts.csv ? { codepage: 65001, raw: true } : {}) });
  const sheetNames = wb.SheetNames;
  if (!sheetNames.length) throw new Error('That file has no sheets.');

  const peek = (name: string) => {
    const ws = wb.Sheets[name];
    if (!ws || !ws['!ref']) return { headers: [] as string[], dataRows: 0 };
    const r = XLSX.utils.decode_range(ws['!ref']);
    const head = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, range: { s: { r: r.s.r, c: r.s.c }, e: { r: r.s.r, c: r.e.c } }, defval: '' })[0] ?? [];
    return { headers: head.map(h => String(h ?? '').trim()).filter(isRealHeader), dataRows: Math.max(0, r.e.r - r.s.r) };
  };

  const scored = sheetNames.map(name => ({ name, ...peek(name) }));
  const best = (scored.find(s => s.dataRows > 0 && s.headers.length > 0) ?? scored[0]).name;

  const load = (sheet: string): SheetData => {
    const ws = wb.Sheets[sheet];
    if (!ws) throw new Error(`Sheet "${sheet}" was not found.`);
    const rows = XLSX.utils.sheet_to_json<RawRow>(ws, { defval: '', raw: true });
    const headers = (rows.length ? Object.keys(rows[0]) : peek(sheet).headers).filter(isRealHeader);
    return { headers, rows };
  };
  return { sheetNames, best, load };
}
