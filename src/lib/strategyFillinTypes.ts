/**
 * strategyFillinTypes.ts — the pure half of a client's saved Strategy Hub work: the shapes it is stored in, how its
 * freshness is told, and how AI output is validated before it is kept. No database, no AI, no React, so the browser,
 * the routes and the tests all share it (strategyFillins.ts is the part that talks to MySQL).
 *
 * One saved record per (client, tool) holds everything the tool produced:
 *   • fields           — the filled-in model (what the client, a template, a document or the AI put in),
 *   • analysis         — the AI's written read-out of those fields (summary, verdict, findings, watch-outs),
 *   • recommendations  — what to do, grounded in the fields,
 *   • actionables      — owner / timeframe / priority next steps.
 * All of it is kept so the tools downstream in the golden thread can read it as input (strategyHubConnections.ts).
 */
import type { FrameworkField } from './strategyFrameworks';

export interface StrategyRecommendation { text: string }

export interface StrategyActionable {
  action: string;
  owner: string;
  timeframe: string;
  priority: 'High' | 'Medium' | 'Low';
}

export interface StrategyAnalysis {
  /** Three to five plain-language sentences: what the filled-in model says. */
  summary: string;
  /** The model's headline conclusion, e.g. "Moderately attractive industry". Null when the model has no single verdict. */
  verdict: { label: string; rationale: string } | null;
  findings: { title: string; detail: string }[];
  /** Assumptions to challenge, risks, gaps in the evidence. */
  watchouts: string[];
}

/** Why the fields last changed in bulk — the reasons a one-step undo is kept for. */
export type FieldChangeReason = 'ai' | 'template' | 'document';

export interface FillinRecord {
  fields: FrameworkField[];
  recommendations: StrategyRecommendation[];
  actionables: StrategyActionable[];
  analysis: StrategyAnalysis | null;
  /** Fingerprint of the fields the analysis was written from. When it no longer matches the current fields, the analysis is out of date. */
  analysisFingerprint: string | null;
  analysisAt: string | null;
  /** The fields as they were before the last AI fill / template import — so it can be undone once. Cleared by the next manual edit. */
  previousFields: FrameworkField[] | null;
  previousReason: FieldChangeReason | null;
  updatedAt: string | null;
  /** Rises by one on every write (hand save, AI fill, analysis, import, undo); 0 before the first save. FUTURESKILZ: added for
   * the workspace's optimistic concurrency (references/05 §4). */
  version: number;
}

export const EMPTY_RECORD: FillinRecord = {
  fields: [],
  recommendations: [],
  actionables: [],
  analysis: null,
  analysisFingerprint: null,
  analysisAt: null,
  previousFields: null,
  previousReason: null,
  updatedAt: null,
  version: 0,
};

/** not_started: nothing filled · in_progress: filled, no analysis yet · analysed: analysis matches the fields · stale: fields changed since. */
export type FillinStatus = 'not_started' | 'in_progress' | 'analysed' | 'stale';

// ── Fingerprint ──────────────────────────────────────────────────────────────

function hash53(str: string): string {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0');
}

/**
 * A fingerprint of what an analysis is written from: each field's label and (trimmed) value, in a fixed order. The
 * source badge (Manual / AI / Template …) is not part of it — only a change of content makes an analysis out of date.
 */
export function fingerprintFields(fields: readonly FrameworkField[]): string {
  const ordered = fields
    .map((f) => [f.label, (f.value ?? '').trim()] as const)
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return hash53(JSON.stringify(ordered));
}

export const countFilled = (fields: readonly FrameworkField[]): number => fields.filter((f) => (f.value ?? '').trim().length > 0).length;

/**
 * The saved field list for a framework: exactly the framework's own fields, in its order, with the client's answer
 * where they gave one and a blank where they did not. Anything posted for a label the framework does not have is
 * dropped. Keeping the list complete and ordered means the fingerprint — and so "is this analysis current?" — does not
 * depend on which fields a particular request happened to include.
 */
export function alignFields(
  frameworkFields: readonly { label: string }[],
  posted: readonly { label: string; value?: string; source?: string }[]
): FrameworkField[] {
  // The last entry for a label wins (a duplicate label in a request must not silently drop a later, newer answer).
  const byLabel = new Map(posted.map((f) => [f.label, f]));
  return frameworkFields.map((def) => {
    const p = byLabel.get(def.label);
    return { label: def.label, value: p?.value ?? '', source: (p?.source ?? '').trim() || 'Manual' };
  });
}

export function fillinStatus(record: Pick<FillinRecord, 'fields' | 'analysis' | 'analysisFingerprint'> | null): FillinStatus {
  if (!record || countFilled(record.fields) === 0) return 'not_started';
  if (!record.analysis) return 'in_progress';
  return record.analysisFingerprint === fingerprintFields(record.fields) ? 'analysed' : 'stale';
}

// ── Validation of what the AI (or a client request) hands back ───────────────

const PRIORITIES: StrategyActionable['priority'][] = ['High', 'Medium', 'Low'];
const asObject = (v: unknown): Record<string, unknown> | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
const nonEmptyString = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;

export function normaliseRecommendations(raw: unknown): StrategyRecommendation[] {
  if (!Array.isArray(raw)) return [];
  const out: StrategyRecommendation[] = [];
  for (const r of raw) {
    // Accept {text} objects, and bare strings (models sometimes return an array of strings).
    const text = typeof r === 'string' ? r : asObject(r)?.text;
    if (nonEmptyString(text)) out.push({ text: text.trim() });
  }
  return out;
}

export function normaliseActionables(raw: unknown): StrategyActionable[] {
  if (!Array.isArray(raw)) return [];
  const out: StrategyActionable[] = [];
  for (const a of raw) {
    const o = asObject(a);
    if (!o || !nonEmptyString(o.action)) continue;
    out.push({
      action: o.action.trim(),
      owner: nonEmptyString(o.owner) ? o.owner.trim() : 'Founder / Owner',
      timeframe: nonEmptyString(o.timeframe) ? o.timeframe.trim() : 'Next 30 days',
      priority: PRIORITIES.includes(o.priority as StrategyActionable['priority']) ? (o.priority as StrategyActionable['priority']) : 'Medium',
    });
  }
  return out;
}

/** Null when there is nothing usable (no summary and no findings) — callers treat that as "the AI gave no analysis". */
export function normaliseAnalysis(raw: unknown): StrategyAnalysis | null {
  const o = asObject(raw);
  if (!o) return null;
  const summary = nonEmptyString(o.summary) ? o.summary.trim() : '';
  const findings: StrategyAnalysis['findings'] = [];
  if (Array.isArray(o.findings)) {
    for (const f of o.findings) {
      const fo = asObject(f);
      if (typeof f === 'string' && f.trim()) findings.push({ title: '', detail: f.trim() });
      else if (fo && (nonEmptyString(fo.detail) || nonEmptyString(fo.title))) {
        findings.push({ title: nonEmptyString(fo.title) ? fo.title.trim() : '', detail: nonEmptyString(fo.detail) ? fo.detail.trim() : '' });
      }
    }
  }
  const watchouts = Array.isArray(o.watchouts) ? o.watchouts.filter(nonEmptyString).map((w) => w.trim()) : [];
  const vo = asObject(o.verdict);
  const verdict = vo && nonEmptyString(vo.label) ? { label: vo.label.trim(), rationale: nonEmptyString(vo.rationale) ? vo.rationale.trim() : '' } : null;
  if (!summary && findings.length === 0) return null;
  return { summary, verdict, findings, watchouts };
}

/** One line for a list or a chip: the verdict if there is one, else the first sentence of the summary. */
export function analysisHeadline(analysis: StrategyAnalysis | null): string | null {
  if (!analysis) return null;
  if (analysis.verdict?.label) return analysis.verdict.label;
  const first = analysis.summary.split(/(?<=[.!?])\s/)[0]?.trim();
  return first || null;
}
