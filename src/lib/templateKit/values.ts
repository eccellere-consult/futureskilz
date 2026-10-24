/**
 * values.ts — cell-level helpers shared by every template kit: the way people actually type numbers and choose from
 * lists, read leniently. Pure.
 */

/** Case/spacing/dash-insensitive form used to compare labels, headers and option values. */
export const norm = (s: unknown) =>
  String(s ?? '').toLowerCase().replace(/[‐-―−]/g, '-').replace(/\s+/g, ' ').trim();

export const isBlank = (v: unknown) => v === null || v === undefined || (typeof v === 'string' && v.trim() === '');

/**
 * "₹1,25,000", "12.5%", "(1,234)" (accounting negative), "−40", "Rs. 500" → numbers; anything else → null.
 * A trailing % is dropped (the sheet's unit column says what the number is).
 */
export function toNumber(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v !== 'string') return null;
  let s = v.trim();
  if (s === '' || s === '-' || s === '—') return null;
  let negative = false;
  const bracket = s.match(/^\((.*)\)$/);
  if (bracket) { negative = true; s = bracket[1]; }
  s = s.replace(/[₹,\s]/g, '').replace(/^rs\.?/i, '').replace(/%$/, '').replace(/^[−–—]/, '-');
  if (s === '' || s === '-') return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return negative ? -Math.abs(n) : n;
}

/**
 * Finds the allowed option a typed value means: an exact (normalised) match first, then a unique prefix/contains
 * match, so "growing", "Growing " and "growing fast" all resolve to "Growing" — but an ambiguous value resolves to
 * nothing rather than a guess.
 */
export function matchOption(raw: unknown, options: readonly string[]): string | null {
  if (isBlank(raw)) return null;
  const want = norm(raw);
  const exact = options.find(o => norm(o) === want);
  if (exact) return exact;
  const loose = options.filter(o => norm(o).startsWith(want) || want.startsWith(norm(o)) || norm(o).includes(want));
  return loose.length === 1 ? loose[0] : null;
}

/** "Cash Flow, Talent; Supply Chain" → ["Cash Flow", "Talent", "Supply Chain"]. */
export function splitMulti(raw: unknown): string[] {
  if (isBlank(raw)) return [];
  return String(raw).split(/[,;\n|]/).map(s => s.trim()).filter(Boolean);
}

/** Yes/No in the ways people write them. null = not recognisable. */
export function toYesNo(raw: unknown): 'Yes' | 'No' | null {
  const s = norm(raw);
  if (['yes', 'y', 'true', '1'].includes(s)) return 'Yes';
  if (['no', 'n', 'false', '0'].includes(s)) return 'No';
  return null;
}
