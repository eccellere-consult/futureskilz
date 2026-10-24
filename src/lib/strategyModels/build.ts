/**
 * strategyModels/build.ts — small constructors so a model definition reads as the model, not as boilerplate. They add no
 * behaviour: each returns the plain objects described in types.ts.
 */
import { toNum } from './values';
import type { Column, FieldPart, RatingScale, Row, Section, TablePart, Part } from './types';

type FieldExtra = Partial<Pick<FieldPart, 'unit' | 'prefill' | 'options' | 'scale'>>;

export const text = (key: string, label: string, help: string, example: string, extra: FieldExtra = {}): FieldPart =>
  ({ kind: 'field', key, label, type: 'text', help, example, ...extra });

export const long = (key: string, label: string, help: string, example: string, extra: FieldExtra = {}): FieldPart =>
  ({ kind: 'field', key, label, type: 'longtext', help, example, ...extra });

export const select = (key: string, label: string, help: string, options: readonly string[], example = '', extra: FieldExtra = {}): FieldPart =>
  ({ kind: 'field', key, label, type: 'select', help, example, options, ...extra });

export const rating = (key: string, label: string, help: string, scale: Partial<RatingScale> = {}, example = '', extra: FieldExtra = {}): FieldPart =>
  ({ kind: 'field', key, label, type: 'rating', help, example, scale: { min: 1, max: 5, low: 'low', high: 'high', ...scale }, ...extra });

export const num = (key: string, label: string, help: string, unit: string, example: string, extra: FieldExtra = {}): FieldPart =>
  ({ kind: 'field', key, label, type: 'number', help, example, unit, ...extra });

type ColExtra = Partial<Pick<Column, 'unit' | 'options' | 'scale' | 'half'>>;

/** Column constructors. */
export const col = {
  text: (key: string, header: string, help: string, extra: ColExtra = {}): Column => ({ key, header, help, type: 'text', ...extra }),
  long: (key: string, header: string, help: string, extra: ColExtra = {}): Column => ({ key, header, help, type: 'longtext', ...extra }),
  num: (key: string, header: string, help: string, unit = '', extra: ColExtra = {}): Column => ({ key, header, help, type: 'number', unit, ...extra }),
  select: (key: string, header: string, help: string, options: readonly string[]): Column => ({ key, header, help, type: 'select', options }),
  rating: (key: string, header: string, help: string, scale: Partial<RatingScale> = {}): Column =>
    ({ key, header, help, type: 'rating', scale: { min: 1, max: 5, low: 'low', high: 'high', ...scale } }),
  computed: (key: string, header: string, help: string, compute: (row: Row, v: import('./types').ModelValues) => string): Column =>
    ({ key, header, help, type: 'computed', compute }),
};

export function table(
  key: string,
  label: string,
  help: string,
  rowLabel: string,
  columns: Column[],
  o: { min?: number; max?: number; fixed?: readonly string[]; hints?: Readonly<Record<string, string>>; example?: Row } = {}
): TablePart {
  const fixedLen = o.fixed?.length;
  return {
    kind: 'table',
    key,
    label,
    help,
    rowLabel,
    columns,
    fixedRows: o.fixed,
    rowHints: o.hints,
    minRows: fixedLen ?? o.min ?? 3,
    maxRows: fixedLen ?? o.max ?? 12,
    exampleRow: o.example,
  };
}

export const section = (key: string, title: string, summary: string, ...parts: Part[]): Section => ({ key, title, summary, parts });

// ── Helpers for computed columns and derived figures ─────────────────────────

/** The numbers in a list of cell texts, ignoring blanks and anything that is not a number. */
export const numbers = (cells: readonly (string | undefined)[]): number[] =>
  cells.map((c) => toNum(c)).filter((n): n is number => n !== null);

export const sum = (ns: readonly number[]): number => ns.reduce((a, b) => a + b, 0);
export const mean = (ns: readonly number[]): number | null => (ns.length ? sum(ns) / ns.length : null);
