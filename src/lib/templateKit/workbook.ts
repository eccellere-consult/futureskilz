/**
 * workbook.ts — turns a KitDefinition (+ optional sample content) into a real .xlsx: a "How to fill" guide, then one
 * styled sheet per kit sheet. Same look as the Process Improvement / Six Sigma Lite kits (gold = needed, grey =
 * optional). Runs in the browser (lazy xlsx) and in Node (tests).
 */
import { loadXlsx } from '../spendAnalysis/xlsxLoader';
import { SAMPLE_MARKER, SAMPLE_NOTICE, kitFileName } from '../demo/marker';
import type { Cell, FieldsSheet, KitContent, KitDefinition, KitField, TableSheet } from './types';

type Xlsx = Awaited<ReturnType<typeof loadXlsx>>;

export const GUIDE_SHEET = 'How to fill';

const INK = '0E0E0D', WHITE = 'FFFFFF', GOLD = 'B8913A', GOLD_PALE = 'F5EDD8', CREAM = 'FAF8F4', BORDER = 'E5E2DB', INK_MID = '3A3935';
const thin = { style: 'thin', color: { rgb: BORDER } };
const box = { top: thin, bottom: thin, left: thin, right: thin };

const FIELD_HEADERS = ['Field', 'Need', 'Value', 'What to enter', 'Allowed values'] as const;

function allowedText(f: KitField): string {
  if (f.options?.length) return f.options.join(' · ');
  if (f.type === 'yesno') return 'Yes · No';
  return '';
}

/** The guide sheet's rows — also what the tests check, so every sheet and field is documented. */
export function guideRows(def: KitDefinition, variant: 'sample' | 'template'): Cell[][] {
  const rows: Cell[][] = [
    [variant === 'sample' ? `SAMPLE — ${def.title}` : def.title],
    [def.breadcrumb],
    [],
    ['How to fill this workbook'],
    ['1. A gold heading marks something that is needed; grey headings are optional. Fill what you have — you can always add more later.'],
    ['2. Where a field lists "Allowed values", pick one of them (spelling and capitals are forgiven). Numbers can be typed plainly: commas, ₹ and (brackets for negatives) are understood.'],
  ];
  let n = 3;
  for (const g of def.guidance) rows.push([`${n++}. ${g}`]);
  rows.push([variant === 'sample'
    ? `${n}. ${SAMPLE_NOTICE} (${SAMPLE_MARKER})`
    : `${n}. The "Example" column and any grey italic text are illustrative only — they show the kind of entry expected, not data to copy.`]);
  rows.push([], ['Sheets in this workbook'], ['Sheet', 'Layout', 'What it holds']);
  for (const s of def.sheets) rows.push([s.name, s.kind === 'fields' ? 'One value per field' : 'Table — one row per line', s.summary]);
  rows.push([], ['Fields and columns'], ['Sheet', 'Field / column', 'Need', 'What to enter', 'Example', 'Allowed values']);
  for (const s of def.sheets) {
    if (s.kind === 'fields') {
      for (const f of s.fields) rows.push([s.name, f.label, f.required ? 'Required' : 'Optional', f.help, f.example ?? '', allowedText(f)]);
    } else {
      for (const c of s.columns) rows.push([s.name, c.header, c.required ? 'Required' : 'Optional', c.help, '', '']);
    }
  }
  if (variant === 'sample') rows.push([], [SAMPLE_MARKER]);
  return rows;
}

/** Headings and table-header rows in the guide, so the writer can style them without re-deriving them. */
const GUIDE_HEADINGS = ['How to fill this workbook', 'Sheets in this workbook', 'Fields and columns'];
const GUIDE_TABLE_HEADERS = [['Sheet', 'Layout', 'What it holds'], ['Sheet', 'Field / column', 'Need', 'What to enter', 'Example', 'Allowed values']];

function guideSheet(XLSX: Xlsx, def: KitDefinition, variant: 'sample' | 'template') {
  const rows = guideRows(def, variant);
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 24 }, { wch: 34 }, { wch: 16 }, { wch: 64 }, { wch: 36 }, { wch: 56 }];
  ws['A1'].s = { font: { bold: true, sz: 16, color: { rgb: variant === 'sample' ? GOLD : INK } } };
  ws['A2'].s = { font: { sz: 10, color: { rgb: INK_MID } } };
  let inTable = false;
  rows.forEach((row, r) => {
    const first = String(row[0] ?? '');
    if (row.length === 0) { inTable = false; return; }
    if (GUIDE_HEADINGS.includes(first)) { ws[XLSX.utils.encode_cell({ r, c: 0 })].s = { font: { bold: true, sz: 11, color: { rgb: GOLD } } }; inTable = false; return; }
    if (GUIDE_TABLE_HEADERS.some(h => h.length === row.length && h[0] === first && h[1] === String(row[1]))) {
      inTable = true;
      row.forEach((_, c) => { ws[XLSX.utils.encode_cell({ r, c })].s = { font: { bold: true, sz: 10, color: { rgb: WHITE } }, fill: { fgColor: { rgb: INK } }, border: box, alignment: { vertical: 'center' } }; });
      return;
    }
    if (inTable) {
      row.forEach((_, c) => {
        const ref = XLSX.utils.encode_cell({ r, c });
        if (!ws[ref]) ws[ref] = { t: 's', v: '' };
        ws[ref].s = { font: { sz: 9.5, bold: c === 0 }, fill: { fgColor: { rgb: r % 2 ? CREAM : WHITE } }, border: box, alignment: { vertical: 'top', wrapText: true } };
      });
    } else if (first === SAMPLE_MARKER) {
      ws[XLSX.utils.encode_cell({ r, c: 0 })].s = { font: { sz: 8, color: { rgb: 'A8A59C' } } };
    }
  });
  return ws;
}

/** A styled table: header row (gold where needed), then body rows. */
function styledTable(XLSX: Xlsx, headers: string[], needed: boolean[], widths: number[], wrap: boolean[], body: Cell[][]) {
  const ws = XLSX.utils.aoa_to_sheet([headers, ...body]);
  ws['!cols'] = widths.map(wch => ({ wch }));
  ws['!rows'] = [{ hpt: 26 }];
  headers.forEach((_, c) => {
    const ref = XLSX.utils.encode_cell({ r: 0, c });
    ws[ref].s = { font: { bold: true, sz: 10, color: { rgb: WHITE } }, fill: { fgColor: { rgb: needed[c] ? GOLD : INK_MID } }, border: box, alignment: { vertical: 'center', wrapText: true } };
  });
  body.forEach((row, r) => {
    row.forEach((_, c) => {
      const ref = XLSX.utils.encode_cell({ r: r + 1, c });
      if (!ws[ref]) ws[ref] = { t: 's', v: '' };
      ws[ref].s = { font: { sz: 9.5 }, fill: { fgColor: { rgb: r % 2 ? CREAM : WHITE } }, border: box, alignment: { vertical: 'top', wrapText: wrap[c] } };
    });
  });
  return ws;
}

function fieldsSheetFor(XLSX: Xlsx, spec: FieldsSheet, values: Record<string, Cell> | undefined) {
  const body: Cell[][] = spec.fields.map(f => [f.label, f.required ? 'Required' : 'Optional', values?.[f.key] ?? '', f.help, allowedText(f)]);
  const ws = styledTable(XLSX, [...FIELD_HEADERS], [false, false, true, false, false], [38, 11, 50, 58, 44], [true, false, true, true, true], body);
  body.forEach((_, r) => {
    const label = ws[XLSX.utils.encode_cell({ r: r + 1, c: 0 })];
    label.s = { ...label.s, font: { sz: 9.5, bold: true }, fill: { fgColor: { rgb: GOLD_PALE } } };
    for (const c of [3, 4]) {
      const cell = ws[XLSX.utils.encode_cell({ r: r + 1, c })];
      cell.s = { ...cell.s, font: { sz: 9, italic: true, color: { rgb: INK_MID } } };
    }
  });
  return ws;
}

function tableSheetFor(XLSX: Xlsx, spec: TableSheet, rows: Record<string, Cell>[] | undefined) {
  const source = rows ?? spec.scaffold ?? [];
  const headers = spec.columns.map(c => c.header);
  const body: Cell[][] = source.map(r => spec.columns.map(c => r[c.key] ?? ''));
  const ws = styledTable(XLSX, headers, spec.columns.map(c => !!c.required), spec.columns.map(c => c.width ?? (c.type === 'number' ? 16 : 44)), spec.columns.map(c => c.type !== 'number'), body);
  // Numbers are right-aligned so a statement reads like one.
  spec.columns.forEach((c, ci) => {
    if (c.type !== 'number') return;
    body.forEach((_, r) => {
      const cell = ws[XLSX.utils.encode_cell({ r: r + 1, c: ci })];
      cell.s = { ...cell.s, alignment: { ...(cell.s?.alignment ?? {}), horizontal: 'right' }, numFmt: '#,##0;(#,##0)' };
    });
  });
  return ws;
}

/** The whole kit as a workbook — filled from `content` (the sample) or as the blank template when `content` is null. */
export function buildKitWorkbook(XLSX: Xlsx, def: KitDefinition, content: KitContent | null) {
  const variant = content ? 'sample' : 'template';
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, guideSheet(XLSX, def, variant), GUIDE_SHEET);
  for (const spec of def.sheets) {
    const given = content?.[spec.name];
    XLSX.utils.book_append_sheet(
      wb,
      spec.kind === 'fields'
        ? fieldsSheetFor(XLSX, spec, given as Record<string, Cell> | undefined)
        : tableSheetFor(XLSX, spec, given as Record<string, Cell>[] | undefined),
      spec.name
    );
  }
  wb.Props = { Title: variant === 'sample' ? `SAMPLE — ${def.title}` : def.title, Subject: variant === 'sample' ? SAMPLE_MARKER : def.breadcrumb, Author: def.author ?? 'Eccellere' };
  return wb;
}

export function kitDownloadName(def: KitDefinition, variant: 'sample' | 'template'): string {
  return kitFileName(def.fileBase, variant);
}

/** Browser download of the sample (pass `content`) or the blank template (pass null). */
export async function downloadKit(def: KitDefinition, content: KitContent | null): Promise<void> {
  const XLSX = await loadXlsx();
  XLSX.writeFile(buildKitWorkbook(XLSX, def, content), kitDownloadName(def, content ? 'sample' : 'template'), { compression: true });
}

/** The workbook as .xlsx bytes (no download) — what the tests use to exercise the real writer and reader together. */
export async function kitBytes(def: KitDefinition, content: KitContent | null): Promise<Uint8Array> {
  const XLSX = await loadXlsx();
  const out = XLSX.write(buildKitWorkbook(XLSX, def, content), { type: 'array', bookType: 'xlsx' }) as ArrayBuffer | Uint8Array;
  return new Uint8Array(out as ArrayBuffer);
}
