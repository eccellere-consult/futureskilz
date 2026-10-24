'use client';

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import {
  completeness,
  computeDerived,
  computeViews,
  evalColumn,
  expandTable,
  isBlankSaved,
  labelColumnKey,
} from '@/lib/strategyModels/values';
import {
  isField,
  type Column,
  type ColumnType,
  type FieldPart,
  type ModelValues,
  type Part,
  type Row,
  type Section,
  type Structure,
  type TablePart,
  type Tone,
} from '@/lib/strategyModels/types';

/** A suggestion for an empty field, from the saved work of a tool this one builds on. */
export interface Suggestion { fromName: string; value: string }

export interface FormChange { values: ModelValues; sources: Record<string, string> }

interface ModelFormProps {
  structure: Structure;
  values: ModelValues;
  sources: Record<string, string>;
  onChange: (next: FormChange) => void;
  /** Demo mode: the answers are shown, not editable. */
  readOnly?: boolean;
  /** Demo mode: one line per part on why the example answer was chosen. */
  why?: Record<string, string>;
  /** Field key → a one-click suggestion from an earlier tool. */
  suggestions?: Record<string, Suggestion>;
  /** Called when a field loses focus — the page saves straight away. */
  onBlur?: () => void;
}

const TONE: Record<Tone, string> = {
  good: 'border-eccellere-teal bg-eccellere-cream text-eccellere-teal',
  warn: 'border-eccellere-gold-light bg-eccellere-gold-pale text-eccellere-ink',
  bad: 'border-eccellere-error bg-white text-eccellere-error',
  neutral: 'border-eccellere-border bg-white text-eccellere-ink',
};

const SOURCE_CLASS = (src: string): string =>
  src === 'Manual' ? 'bg-eccellere-border/20 text-eccellere-ink-light'
  : src === 'AI' ? 'bg-eccellere-gold-pale text-eccellere-gold'
  : 'bg-eccellere-cream text-eccellere-teal';

const inputBase = 'w-full text-sm text-eccellere-ink bg-eccellere-cream border border-eccellere-border rounded-[2px] px-3 py-2 leading-relaxed placeholder:text-eccellere-ink-light/70 disabled:bg-white disabled:text-eccellere-ink-mid read-only:bg-white read-only:text-eccellere-ink-mid focus:outline-none focus:border-eccellere-gold';

// ── Controls ─────────────────────────────────────────────────────────────────

/**
 * A text box that is always exactly as tall as what is in it — no fixed character cap, no hidden second half of an answer,
 * no scrolling inside the box. `rows` is the least height it keeps.
 */
function AutoText({ id, value, rows, placeholder, readOnly, label, onChange, onBlur, className }: {
  id?: string; value: string; rows: number; placeholder?: string; readOnly?: boolean; label?: string; className: string;
  onChange: (v: string) => void; onBlur?: () => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const fit = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight + el.offsetHeight - el.clientHeight}px`;
  }, []);
  useLayoutEffect(() => { fit(); }, [value, rows, fit]);
  // When the box becomes wider or narrower (the page is resized, a table switches layout) the same text wraps differently.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let last = el.clientWidth;
    const ro = new ResizeObserver(() => { if (el.clientWidth !== last) { last = el.clientWidth; fit(); } });
    ro.observe(el);
    return () => ro.disconnect();
  }, [fit]);
  return (
    <textarea
      ref={ref}
      id={id}
      rows={rows}
      value={value}
      readOnly={readOnly}
      placeholder={placeholder}
      aria-label={label}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      className={`${className} resize-none overflow-hidden`}
    />
  );
}

/** Width in px of one step of a rating, in a form field and in a table cell. */
const STEP_W = 40;
const CELL_STEP_W = 30;

/**
 * A rating as a row of numbered buttons: one click to answer, the whole scale in view. Clicking the chosen one again clears it.
 * `compact` is the table-cell size (the legend then lives in the column heading).
 */
function RatingInput({ value, min, max, low, high, disabled, onChange, onBlur, label, compact }: {
  value: string; min: number; max: number; low: string; high: string; disabled?: boolean; label: string; compact?: boolean;
  onChange: (v: string) => void; onBlur?: () => void;
}) {
  const steps: number[] = [];
  for (let i = min; i <= max; i += 1) steps.push(i);
  const w = compact ? CELL_STEP_W : STEP_W;
  return (
    <div>
      <div role="radiogroup" aria-label={label} className="inline-flex" title={`${min} = ${low} … ${max} = ${high}`}>
        {steps.map((n) => {
          const on = value === String(n);
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={`${label}: ${n}`}
              disabled={disabled}
              onClick={() => { onChange(on ? '' : String(n)); onBlur?.(); }}
              style={{ width: w }}
              className={`${compact ? 'h-8 text-[13px]' : 'h-9 text-sm'} border font-semibold transition-colors -ml-px first:ml-0 first:rounded-l-[2px] last:rounded-r-[2px] disabled:cursor-default ${on ? 'z-10 border-eccellere-gold bg-eccellere-gold text-white' : 'border-eccellere-border bg-white text-eccellere-ink-mid hover:border-eccellere-gold hover:text-eccellere-gold'}`}
            >
              {n}
            </button>
          );
        })}
      </div>
      {!compact && (
        <div className="mt-1 flex justify-between text-[10.5px] text-eccellere-ink-light" style={{ width: steps.length * w }}>
          <span>{min} = {low}</span><span>{max} = {high}</span>
        </div>
      )}
    </div>
  );
}

function FieldControl({ part, value, disabled, onChange, onBlur, id }: {
  part: FieldPart; value: string; disabled?: boolean; id: string; onChange: (v: string) => void; onBlur?: () => void;
}) {
  const placeholder = part.example ? `e.g. ${part.example}` : '';
  switch (part.type) {
    case 'select':
      return (
        <select id={id} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} onBlur={onBlur} className={inputBase}>
          <option value="">Choose…</option>
          {(part.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    case 'rating': {
      const sc = part.scale!;
      return <RatingInput value={value} min={sc.min} max={sc.max} low={sc.low} high={sc.high} disabled={disabled} label={part.label} onChange={onChange} onBlur={onBlur} />;
    }
    case 'number':
      return (
        <div className="flex items-center gap-2">
          <input id={id} type="text" inputMode="decimal" value={value} readOnly={disabled} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} onBlur={onBlur} className={`${inputBase} max-w-[200px]`} />
          {part.unit && <span className="text-xs text-eccellere-ink-light">{part.unit}</span>}
        </div>
      );
    case 'text':
      return <AutoText id={id} rows={1} value={value} readOnly={disabled} placeholder={placeholder} onChange={onChange} onBlur={onBlur} className={inputBase} />;
    default:
      return <AutoText id={id} rows={disabled ? 1 : 3} value={value} readOnly={disabled} placeholder={placeholder} onChange={onChange} onBlur={onBlur} className={inputBase} />;
  }
}

function CellControl({ col, value, disabled, onChange, onBlur, label }: {
  col: Column; value: string; disabled?: boolean; label: string; onChange: (v: string) => void; onBlur?: () => void;
}) {
  const cell = `${inputBase} !py-1.5 !px-2 text-[13px]`;
  switch (col.type) {
    case 'select':
      return (
        <select aria-label={label} value={value} disabled={disabled} onBlur={onBlur} className={cell} onChange={(e) => onChange(e.target.value)}>
          <option value="">—</option>
          {(col.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    case 'rating': {
      const sc = col.scale!;
      return <RatingInput compact label={label} value={value} min={sc.min} max={sc.max} low={sc.low} high={sc.high} disabled={disabled} onChange={onChange} onBlur={onBlur} />;
    }
    case 'number':
      return <input aria-label={label} type="text" inputMode="decimal" value={value} readOnly={disabled} onBlur={onBlur} className={cell} onChange={(e) => onChange(e.target.value)} placeholder={col.unit ? col.unit : ''} />;
    case 'longtext':
      return <AutoText label={label} rows={disabled ? 1 : 3} value={value} readOnly={disabled} onChange={onChange} onBlur={onBlur} className={cell} />;
    default:
      return <AutoText label={label} rows={1} value={value} readOnly={disabled} onChange={onChange} onBlur={onBlur} className={cell} />;
  }
}

// ── A table ──────────────────────────────────────────────────────────────────

/** The least width, in px, each kind of column is comfortable in, and the share of any spare width it takes (fr). */
const COL_MIN: Record<Exclude<ColumnType, 'rating'>, number> = { text: 130, longtext: 230, number: 96, select: 130, computed: 104 };
const COL_FR: Record<ColumnType, number> = { text: 1.4, longtext: 4, number: 0.8, select: 1.2, rating: 0, computed: 0.8 };
const LABEL_COL = 150;
const REMOVE_COL = 24;
const GAP = 12;
const ROW_PAD = 24;

const isLabelCol = (t: TablePart, ci: number): boolean => !!t.fixedRows && ci === 0;

/** A rating column is exactly as wide as its row of buttons. */
const ratingWidth = (c: Column): number => (c.scale ? (c.scale.max - c.scale.min + 1) * CELL_STEP_W : 150);
/** A choice column needs room for its longest option (about 7px a character, plus the arrow). */
const selectMin = (c: Column): number => Math.min(260, Math.max(COL_MIN.select, Math.ceil(Math.max(0, ...(c.options ?? []).map((o) => o.length)) * 7) + 38));
const colMin = (c: Column): number => (c.type === 'rating' ? ratingWidth(c) : c.type === 'select' ? selectMin(c) : COL_MIN[c.type]);

/** Column widths on a wide screen: the model's own row names get a fixed share, long text gets room, numbers and ratings stay compact. */
function gridOf(t: TablePart): string {
  const cols = t.columns.map((c, i) => {
    if (isLabelCol(t, i)) return `minmax(${LABEL_COL}px,1.1fr)`;
    if (c.type === 'rating') return `${ratingWidth(c)}px`;
    return `minmax(${colMin(c)}px,${COL_FR[c.type]}fr)`;
  });
  if (!t.fixedRows) cols.push(`${REMOVE_COL}px`);
  return cols.join(' ');
}

/** Below this width the columns would be squeezed or clipped, so each row is shown as a card with labelled cells instead. */
function neededWidth(t: TablePart): number {
  const cols = t.columns.map((c, i) => (isLabelCol(t, i) ? LABEL_COL : colMin(c)));
  const n = cols.length + (t.fixedRows ? 0 : 1);
  return cols.reduce((a, b) => a + b, 0) + (t.fixedRows ? 0 : REMOVE_COL) + (n - 1) * GAP + ROW_PAD;
}

/** A column heading: its name, the unit if it is a number, and for a rating what its ends mean. */
function ColumnHeading({ col, block }: { col: Column; block?: boolean }) {
  return (
    <div title={col.help} className={block ? 'mb-1' : undefined}>
      <div className={`text-[10.5px] font-semibold uppercase tracking-wider ${block ? 'text-eccellere-ink-light' : 'text-eccellere-ink-mid'}`}>{col.header}{col.type === 'number' && col.unit ? ` (${col.unit})` : ''}</div>
      {col.type === 'rating' && col.scale && (
        <div className="mt-0.5 text-[10px] font-normal normal-case leading-tight tracking-normal text-eccellere-ink-light">
          <span className="block">{col.scale.min} = {col.scale.low}</span>
          <span className="block">{col.scale.max} = {col.scale.high}</span>
        </div>
      )}
    </div>
  );
}

function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      setWidth((prev) => (Math.abs(prev - w) < 1 ? prev : w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, width };
}

function TableEditor({ part, values, readOnly, onRows, onBlur }: {
  part: TablePart; values: ModelValues; readOnly?: boolean; onRows: (rows: Row[]) => void; onBlur?: () => void;
}) {
  const { ref, width } = useElementWidth<HTMLDivElement>();
  const rows = expandTable(part, values.tables[part.key]);
  const fixed = !!part.fixedRows;
  const labelKey = labelColumnKey(part);
  const grid = gridOf(part);
  // Until the width is known (first paint) the wide layout is assumed.
  const wide = width === 0 || width >= neededWidth(part);
  const setCell = (ri: number, key: string, v: string) => onRows(rows.map((r, i) => (i === ri ? { ...r, [key]: v } : r)));
  const hint = (r: Row) => part.rowHints?.[r[labelKey] ?? ''];
  const removable = !fixed && !readOnly;
  const canRemove = removable && rows.length > part.minRows;

  const removeButton = (ri: number, className: string) => (
    <button type="button" aria-label={`Remove ${part.rowLabel.toLowerCase()} ${ri + 1}`} onClick={() => { onRows(rows.filter((_, i) => i !== ri)); onBlur?.(); }} className={className}>✕</button>
  );
  const labelCell = (row: Row) => (
    <div>
      <div className="text-sm font-semibold text-eccellere-ink">{row[labelKey]}</div>
      {hint(row) && <div className="mt-0.5 text-[11px] leading-snug text-eccellere-ink-light">{hint(row)}</div>}
    </div>
  );
  const control = (c: Column, row: Row, ri: number) => {
    if (c.type === 'computed') {
      const text = evalColumn(c, row, values);
      return (
        <div className={`inline-block min-h-[32px] rounded-[2px] border px-2 py-1.5 text-[13px] font-semibold ${text ? 'border-eccellere-gold-light bg-eccellere-gold-pale text-eccellere-ink' : 'border-transparent text-eccellere-ink-light'}`}>{text || '—'}</div>
      );
    }
    // A control is named after its row, so a screen reader says "Threat of substitutes: Intensity", not "Force 4: Intensity".
    const rowName = fixed && row[labelKey] ? row[labelKey] : `${part.rowLabel} ${ri + 1}`;
    return <CellControl col={c} value={row[c.key] ?? ''} disabled={readOnly} label={`${rowName}: ${c.header}`} onChange={(v) => setCell(ri, c.key, v)} onBlur={onBlur} />;
  };
  // In the card layout, words get the full width and the short answers (ratings, numbers, choices, results) sit side by side beneath.
  const isShort = (c: Column): boolean => c.type === 'rating' || c.type === 'number' || c.type === 'select' || c.type === 'computed';
  const shortWidth = (c: Column): string => (c.type === 'number' ? 'w-[120px]' : c.type === 'select' ? 'min-w-[150px]' : '');
  const labelled = (c: Column, row: Row, ri: number, className: string) => (
    <div key={c.key} className={className}>
      <ColumnHeading col={c} block />
      {control(c, row, ri)}
    </div>
  );
  // The long-text columns in the card layout: one under another, except that two in a row marked `half` sit side by side.
  const longBlocks: Column[][] = [];
  part.columns.forEach((c, ci) => {
    if (isLabelCol(part, ci) || isShort(c)) return;
    const last = longBlocks[longBlocks.length - 1];
    if (c.half && last && last.length === 1 && last[0].half) last.push(c); else longBlocks.push([c]);
  });

  return (
    <div ref={ref} data-layout={wide ? 'table' : 'cards'} className="overflow-hidden rounded-[2px] border border-eccellere-border bg-white">
      {wide && (
        <div className="grid gap-3 border-b border-eccellere-border bg-eccellere-gold-pale px-3 py-2" style={{ gridTemplateColumns: grid }}>
          {part.columns.map((c) => <ColumnHeading key={c.key} col={c} />)}
          {!fixed && <div aria-hidden="true" />}
        </div>
      )}
      <div>
        {rows.map((row, ri) => (
          <div key={ri} className="relative border-b border-eccellere-border px-3 py-3 last:border-b-0">
            {wide ? (
              <div className="grid items-start gap-3" style={{ gridTemplateColumns: grid }}>
                {part.columns.map((c, ci) => <div key={c.key} className="min-w-0">{isLabelCol(part, ci) ? labelCell(row) : control(c, row, ri)}</div>)}
                {!fixed && <div className="pt-1 text-right">{canRemove && removeButton(ri, 'text-xs text-eccellere-ink-light hover:text-eccellere-error')}</div>}
              </div>
            ) : (
              <div className={`space-y-3 ${canRemove ? 'pr-6' : ''}`}>
                {fixed && labelCell(row)}
                {longBlocks.map((b) => (b.length === 2
                  ? <div key={b[0].key} className="grid gap-3 sm:grid-cols-2">{b.map((c) => labelled(c, row, ri, 'min-w-0'))}</div>
                  : labelled(b[0], row, ri, 'min-w-0')))}
                {part.columns.some((c, ci) => !isLabelCol(part, ci) && isShort(c)) && (
                  <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
                    {part.columns.map((c, ci) => (!isLabelCol(part, ci) && isShort(c) ? labelled(c, row, ri, `min-w-0 ${shortWidth(c)}`) : null))}
                  </div>
                )}
                {canRemove && removeButton(ri, 'absolute right-2 top-2 text-xs text-eccellere-ink-light hover:text-eccellere-error')}
              </div>
            )}
          </div>
        ))}
      </div>
      {removable && rows.length < part.maxRows && (
        <div className="border-t border-eccellere-border bg-eccellere-cream px-3 py-2">
          <button type="button" onClick={() => onRows([...rows, {}])} className="text-xs font-semibold text-eccellere-gold hover:underline">+ Add a {part.rowLabel.toLowerCase()}</button>
          <span className="ml-3 text-[11px] text-eccellere-ink-light">up to {part.maxRows}</span>
        </div>
      )}
    </div>
  );
}

// ── The form ─────────────────────────────────────────────────────────────────

function SectionCard({ section, children }: { section: Section; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-eccellere-border rounded-[2px] p-6 md:p-8">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-eccellere-gold m-0">{section.title}</h3>
      {section.summary && <p className="mt-1 mb-5 text-xs leading-relaxed text-eccellere-ink-light">{section.summary}</p>}
      <div className="space-y-6">{children}</div>
    </section>
  );
}

export default function ModelForm({ structure, values, sources, onChange, readOnly, why, suggestions, onBlur }: ModelFormProps) {
  const uid = useId();
  const { filled, total } = completeness(structure, values);
  const derived = computeDerived(structure, values).filter((d) => d.value !== null);
  const views = computeViews(structure, values);

  const edit = (next: ModelValues, key: string, hasContent: boolean) =>
    onChange({ values: next, sources: { ...sources, [key]: hasContent ? 'Manual' : (sources[key] ?? 'Manual') } });

  const setField = (key: string, v: string) => edit({ ...values, fields: { ...values.fields, [key]: v } }, key, v.trim().length > 0);
  const setRows = (key: string, rows: Row[]) => edit({ ...values, tables: { ...values.tables, [key]: rows } }, key, rows.some((r) => Object.values(r).some((x) => (x ?? '').trim())));

  const isAnswered = (p: Part): boolean => (isField(p) ? !isBlankSaved(p, values.fields[p.key]) : !isBlankSaved(p, JSON.stringify(values.tables[p.key] ?? [])));

  return (
    <div className="space-y-6">
      {!readOnly && (
        <div className="flex items-center gap-3 text-xs text-eccellere-ink-light" aria-label={`${filled} of ${total} parts answered`}>
          <div className="h-1.5 w-32 bg-eccellere-border/50"><div className="h-full bg-eccellere-teal transition-all" style={{ width: `${total ? (filled / total) * 100 : 0}%` }} /></div>
          <span>{filled} of {total} parts answered</span>
        </div>
      )}

      {structure.sections.map((sec) => {
        // A worked example shows what was answered; the parts left empty would only be blank boxes.
        const parts = readOnly ? sec.parts.filter(isAnswered) : sec.parts;
        if (parts.length === 0) return null;
        return (
          <SectionCard key={sec.key} section={sec}>
            {parts.map((p) => {
              const answered = isAnswered(p);
              const src = sources[p.key] ?? 'Manual';
              const id = `${uid}-${p.key}`;
              const suggestion = isField(p) ? suggestions?.[p.key] : undefined;
              const prefillHint = isField(p) && p.prefill && typeof p.prefill === 'string' ? (p.prefill === 'business_context' ? 'Business Context' : 'Value Scan') : '';
              return (
                <div key={p.key} id={`part-${p.key}`}>
                  <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                    <label htmlFor={isField(p) && p.type !== 'rating' ? id : undefined} className="text-sm font-semibold text-eccellere-ink">{p.label}</label>
                    {!readOnly && (answered
                      ? <span className={`ml-2 flex-shrink-0 rounded-[2px] px-1.5 py-0.5 text-[10px] font-bold uppercase ${SOURCE_CLASS(src)}`}>{src}</span>
                      : prefillHint && <span className="ml-2 flex-shrink-0 text-[10px] text-eccellere-ink-light">AI can draw this from your {prefillHint}</span>)}
                  </div>
                  {p.help && <p className="m-0 mb-2 text-xs leading-relaxed text-eccellere-ink-light">{p.help}</p>}
                  {suggestion && !answered && !readOnly && (
                    <div className="mb-2 flex flex-wrap items-start gap-2 rounded-[2px] border border-eccellere-gold-light bg-eccellere-gold-pale px-3 py-2">
                      <p className="m-0 min-w-[200px] flex-1 text-xs leading-relaxed text-eccellere-ink-mid"><span className="font-semibold text-eccellere-ink">From your {suggestion.fromName}:</span> {suggestion.value.length > 280 ? `${suggestion.value.slice(0, 280)}…` : suggestion.value}</p>
                      <button type="button" onClick={() => { onChange({ values: { ...values, fields: { ...values.fields, [p.key]: suggestion.value } }, sources: { ...sources, [p.key]: `upstream: ${suggestion.fromName}` } }); onBlur?.(); }} className="flex-shrink-0 rounded-[2px] border border-eccellere-gold bg-white px-3 py-1 text-xs font-semibold text-eccellere-gold hover:bg-eccellere-gold hover:text-white">Use this</button>
                    </div>
                  )}
                  {isField(p)
                    ? <FieldControl part={p} id={id} value={values.fields[p.key] ?? ''} disabled={readOnly} onChange={(v) => setField(p.key, v)} onBlur={onBlur} />
                    : <TableEditor part={p} values={values} readOnly={readOnly} onRows={(rows) => setRows(p.key, rows)} onBlur={onBlur} />}
                  {why?.[p.key] && <p className="m-0 mt-2 border-l-2 border-eccellere-gold-light pl-3 text-xs italic leading-relaxed text-eccellere-ink-mid"><span className="not-italic font-semibold text-eccellere-gold">Why this answer: </span>{why[p.key]}</p>}
                </div>
              );
            })}
          </SectionCard>
        );
      })}

      {/* Tables of figures the model works out (statements, projections): shown, never entered */}
      {views.map((view) => (
        <section key={view.key} className="bg-white border border-eccellere-border rounded-[2px] p-6 md:p-8" aria-label={view.title} data-testid={`view-${view.key}`}>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-eccellere-gold m-0">{view.title}</h3>
          {view.help && <p className="mt-1 mb-4 text-xs leading-relaxed text-eccellere-ink-light">{view.help}</p>}
          {view.hasFigures ? (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[420px] border-collapse text-[13px]">
                <thead>
                  <tr>
                    {[view.rowHeading, ...view.columns].map((h, i) => (
                      <th key={`${h}-${i}`} scope="col" className={`border-b border-eccellere-border bg-eccellere-gold-pale px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-eccellere-ink-mid ${i === 0 ? 'text-left' : 'text-right'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {view.rows.map((r) => (
                    <tr key={r.name} className={r.strong ? 'bg-eccellere-cream font-semibold' : ''}>
                      <th scope="row" className="border-b border-eccellere-border px-3 py-1.5 text-left font-[inherit] text-eccellere-ink">{r.name}</th>
                      {r.cells.map((c, i) => <td key={i} className="border-b border-eccellere-border px-3 py-1.5 text-right tabular-nums text-eccellere-ink">{c || '—'}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-3 mb-0 text-xs text-eccellere-ink-light">Fill in the starting point and the assumptions above — the figures appear here as you go.</p>
          )}
        </section>
      ))}

      {derived.length > 0 && (
        <section className="bg-white border border-eccellere-border rounded-[2px] p-6 md:p-8" aria-label="Results at a glance">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-eccellere-gold m-0 mb-4">Results at a glance</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {derived.map((d) => (
              <div key={d.key} title={d.help} className={`rounded-[2px] border px-4 py-3 ${TONE[d.tone ?? 'neutral']}`}>
                <div className="text-[10.5px] font-semibold uppercase tracking-wider opacity-80">{d.label}</div>
                <div className="mt-0.5 font-display text-xl leading-snug">{d.value}</div>
              </div>
            ))}
          </div>
          <p className="m-0 mt-3 text-[11px] text-eccellere-ink-light">Worked out from {readOnly ? 'the answers above' : 'your answers as you type'} — an aid to thinking, not a verdict. {readOnly ? 'The analysis below gives the full reading.' : 'Run the analysis for the full reading.'}</p>
        </section>
      )}
    </div>
  );
}
