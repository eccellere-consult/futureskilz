/**
 * strategyModels/boards.ts — the pure rules of the board (canvas) kind. A board is a table whose rows are notes (see BoardSpec in
 * types.ts), so nothing here talks to the screen or the database: the editor calls these functions, and the tests call them directly.
 *
 * Rules that hold for every function below:
 *  - A note is never lost. A note whose region is not one of the board's regions is "unplaced" and shown in a tray until it is moved.
 *  - A move returns a new array and never changes the notes themselves, only where they sit (a region, a position, or an x/y rating).
 *  - Ratings on a grid are whole numbers inside the column's scale; anything else is clamped.
 */
import { col, table } from './build';
import { normaliseRow, toNum } from './values';
import type { BoardSpec, Column, ModelValues, RatingScale, Row, TablePart } from './types';

/** The tray for a note whose region is not one of the board's regions. */
export const UNPLACED = 'Unplaced';

const spec = (t: TablePart): BoardSpec => {
  if (!t.board) throw new Error(`Table "${t.key}" is not a board`);
  return t.board;
};
const column = (t: TablePart, key: string | undefined): Column => {
  const c = t.columns.find((x) => x.key === key);
  if (!c) throw new Error(`Board "${t.key}": column "${key}" is not one of its columns`);
  return c;
};
const scaleOf = (c: Column): RatingScale => c.scale ?? { min: 1, max: 5, low: 'low', high: 'high' };
const clamp = (n: number, s: { min: number; max: number }) => Math.min(s.max, Math.max(s.min, Math.round(n)));

/** The notes of a board, as saved (blank rows removed, cells trimmed). */
export const boardRows = (t: TablePart, v: ModelValues): Row[] => cleanBoard(t, v.tables[t.key] ?? []);

/** The regions of a regions board: the model's own (the select's options), or the groups the client has made, in the order first used, up to the limit. */
export function regionList(t: TablePart, rows: readonly Row[]): string[] {
  const b = spec(t);
  if (b.layout !== 'regions') return [];
  const c = column(t, b.regionColumn);
  if (b.freeRegions) {
    const seen: string[] = [];
    for (const r of rows) { const g = (r[c.key] ?? '').trim(); if (g && !seen.includes(g)) seen.push(g); }
    return seen.slice(0, b.freeRegions.max);
  }
  return [...(c.options ?? [])];
}

/** The region a note sits in, or UNPLACED. */
export function regionOf(t: TablePart, row: Row, regions: readonly string[]): string {
  const b = spec(t);
  if (b.layout !== 'regions') return UNPLACED;
  const g = (row[b.regionColumn!] ?? '').trim();
  return regions.includes(g) ? g : UNPLACED;
}

/** Notes counted by region (UNPLACED included only when something is in it). A free-region group with no notes counts 0. */
export function countsByRegion(t: TablePart, rows: readonly Row[]): Record<string, number> {
  const b = spec(t);
  const regions = regionList(t, rows);
  const out: Record<string, number> = Object.fromEntries(regions.map((r) => [r, 0]));
  for (const r of rows) {
    if (!(r[b.noteColumn] ?? '').trim()) continue;
    const g = regionOf(t, r, regions);
    out[g] = (out[g] ?? 0) + 1;
  }
  if (out[UNPLACED] === 0) delete out[UNPLACED];
  return out;
}

/** The x/y rating of a grid note, or null until both are rated. */
export function cellOf(t: TablePart, row: Row): { x: number; y: number } | null {
  const b = spec(t);
  if (b.layout !== 'grid') return null;
  const x = toNum(row[b.xColumn!]), y = toNum(row[b.yColumn!]);
  return x === null || y === null ? null : { x, y };
}

/** The quadrant of a grid note. A value is "high" when it is above the middle of its scale (on 1 to 10 that is 6 and up; on 1 to 5, 4 and up). */
export function quadrantOf(t: TablePart, row: Row): string | null {
  const b = spec(t);
  const cell = cellOf(t, row);
  if (!cell || !b.quadrants) return null;
  const xs = scaleOf(column(t, b.xColumn)), ys = scaleOf(column(t, b.yColumn));
  const xHigh = cell.x > (xs.min + xs.max) / 2, yHigh = cell.y > (ys.min + ys.max) / 2;
  return b.quadrants.find((q) => q.xHigh === xHigh && q.yHigh === yHigh)?.name ?? null;
}

/**
 * Tidies the notes of a board for saving. Cells are trimmed through the table's own rules; a rating is rounded and kept inside its
 * scale; a note with no text is dropped, except a free-region group that has been named (an empty group is a saved row). A note with
 * an unknown region is kept and will show as unplaced.
 */
export function cleanBoard(t: TablePart, rows: readonly Row[] | undefined): Row[] {
  const b = spec(t);
  const ratingCols = t.columns.filter((c) => c.type === 'rating');
  const out: Row[] = [];
  for (const raw of rows ?? []) {
    const row = normaliseRow(t, raw);
    for (const c of ratingCols) {
      const n = toNum(row[c.key]);
      if (n === null) delete row[c.key]; else row[c.key] = String(clamp(n, scaleOf(c)));
    }
    const hasNote = !!(row[b.noteColumn] ?? '').trim();
    const namedGroup = !!b.freeRegions && !!(row[b.regionColumn!] ?? '').trim();
    if (hasNote || namedGroup) out.push(row);
  }
  return out;
}

export type BoardTarget = { region: string; before?: number } | { x: number; y: number };

/** The notes after a move, and where the moved note now is (so the editor keeps the focus on it). `index` is -1 when nothing could be moved. */
export interface Placed { rows: Row[]; index: number }

/**
 * Moves one note. For a regions board the target is a region and, optionally, the index of the note it goes in front of (so the order
 * inside a region is the order in the array); with no position the note joins the end of the region. For a grid board the target is an
 * x/y rating, snapped to the scale and the order does not change.
 */
export function placeNote(t: TablePart, rows: readonly Row[], index: number, target: BoardTarget): Placed {
  const b = spec(t);
  const next = rows.map((r) => ({ ...r }));
  if (index < 0 || index >= rows.length) return { rows: next, index: -1 };
  if (b.layout === 'grid') {
    if (!('x' in target)) return { rows: next, index };
    next[index][b.xColumn!] = String(clamp(target.x, scaleOf(column(t, b.xColumn))));
    next[index][b.yColumn!] = String(clamp(target.y, scaleOf(column(t, b.yColumn))));
    return { rows: next, index };
  }
  if (!('region' in target)) return { rows: next, index };
  const regions = regionList(t, rows);
  const [moved] = next.splice(index, 1);
  const to = target.region === UNPLACED ? '' : target.region;
  moved[b.regionColumn!] = to;
  let at = next.length;
  if (target.before !== undefined) {
    // `before` indexes the array as it was; account for the note having been taken out of it.
    at = Math.min(next.length, Math.max(0, target.before > index ? target.before - 1 : target.before));
  } else {
    const last = next.map((r) => regionOf(t, r, regions) === (to || UNPLACED)).lastIndexOf(true);
    at = last < 0 ? next.length : last + 1;
  }
  next.splice(at, 0, moved);
  return { rows: next, index: at };
}

export type Nudge = 'left' | 'right' | 'up' | 'down';

/**
 * The keyboard move. On a regions board left/right change the region and up/down change the order inside it. On a grid left/right
 * change the x rating and up/down the y rating (up is higher). Returns the new notes and a sentence for a screen reader.
 */
export function nudge(t: TablePart, rows: readonly Row[], index: number, dir: Nudge): { rows: Row[]; index: number; announce: string } {
  const b = spec(t);
  const note = (rows[index]?.[b.noteColumn] ?? '').trim() || b.noteLabel;
  if (index < 0 || index >= rows.length) return { rows: rows.map((r) => ({ ...r })), index: -1, announce: '' };
  if (b.layout === 'grid') {
    const cell = cellOf(t, rows[index]) ?? { x: scaleOf(column(t, b.xColumn)).min, y: scaleOf(column(t, b.yColumn)).min };
    const d = dir === 'left' ? { x: -1, y: 0 } : dir === 'right' ? { x: 1, y: 0 } : dir === 'up' ? { x: 0, y: 1 } : { x: 0, y: -1 };
    const moved = placeNote(t, rows, index, { x: cell.x + d.x, y: cell.y + d.y });
    const now = cellOf(t, moved.rows[index])!;
    const quad = quadrantOf(t, moved.rows[index]);
    return { rows: moved.rows, index, announce: `${note}: ${b.axes?.x.label ?? 'x'} ${now.x}, ${b.axes?.y.label ?? 'y'} ${now.y}${quad ? `, ${quad}` : ''}.` };
  }
  const regions = regionList(t, rows);
  const here = regionOf(t, rows[index], regions);
  if (dir === 'left' || dir === 'right') {
    const at = regions.indexOf(here);
    const to = regions[dir === 'left' ? Math.max(0, (at < 0 ? 0 : at) - 1) : Math.min(regions.length - 1, at + 1)];
    if (to === undefined || to === here) return { rows: rows.map((r) => ({ ...r })), index, announce: `${note} stays in ${here}.` };
    const moved = placeNote(t, rows, index, { region: to });
    return { rows: moved.rows, index: moved.index, announce: `${note} moved to ${to}.` };
  }
  const mates = rows.map((r, i) => ({ i, g: regionOf(t, r, regions) })).filter((x) => x.g === here).map((x) => x.i);
  const pos = mates.indexOf(index);
  const swapWith = mates[dir === 'up' ? pos - 1 : pos + 1];
  if (swapWith === undefined) return { rows: rows.map((r) => ({ ...r })), index, announce: `${note} is already ${dir === 'up' ? 'first' : 'last'} in ${here}.` };
  const next = rows.map((r) => ({ ...r }));
  [next[index], next[swapWith]] = [next[swapWith], next[index]];
  return { rows: next, index: swapWith, announce: `${note} moved ${dir} in ${here}, position ${(dir === 'up' ? pos : pos + 2)} of ${mates.length}.` };
}

/** A board table: the constructor a definition uses. It builds the columns the spec names, so the two cannot disagree. */
export function boardTable(
  key: string, label: string, help: string, b: BoardSpec,
  o: { regions?: readonly string[]; statuses?: readonly string[]; scale?: Partial<RatingScale>; maxRows?: number; example?: Row } = {},
): TablePart {
  const columns: Column[] = [];
  if (b.layout === 'regions') {
    columns.push(o.regions && !b.freeRegions
      ? col.select(b.regionColumn!, 'Region', `Where the ${b.noteLabel} sits.`, o.regions)
      : col.text(b.regionColumn!, 'Group', `The group the ${b.noteLabel} belongs to; name your own.`));
    columns.push(col.long(b.noteColumn, b.noteLabel[0].toUpperCase() + b.noteLabel.slice(1), `One short ${b.noteLabel}, in your own words.`));
  } else {
    columns.push(col.long(b.noteColumn, b.noteLabel[0].toUpperCase() + b.noteLabel.slice(1), `One short ${b.noteLabel}, in your own words.`));
    columns.push(col.rating(b.xColumn!, b.axes?.x.label ?? 'X', `${b.axes?.x.label ?? 'X'}: ${b.axes?.x.low ?? 'low'} to ${b.axes?.x.high ?? 'high'}.`, { low: b.axes?.x.low ?? 'low', high: b.axes?.x.high ?? 'high', ...o.scale }));
    columns.push(col.rating(b.yColumn!, b.axes?.y.label ?? 'Y', `${b.axes?.y.label ?? 'Y'}: ${b.axes?.y.low ?? 'low'} to ${b.axes?.y.high ?? 'high'}.`, { low: b.axes?.y.low ?? 'low', high: b.axes?.y.high ?? 'high', ...o.scale }));
  }
  if (b.statusColumn) columns.push(col.select(b.statusColumn, 'Status', `How far the ${b.noteLabel} has been checked.`, o.statuses ?? Object.keys(b.statusTones ?? {})));
  const t = table(key, label, help, b.noteLabel[0].toUpperCase() + b.noteLabel.slice(1), columns, { min: 0, max: o.maxRows ?? 40, example: o.example });
  return { ...t, board: b };
}

export const isBoard = (p: { kind: string }): p is TablePart => p.kind === 'table' && !!(p as TablePart).board;
