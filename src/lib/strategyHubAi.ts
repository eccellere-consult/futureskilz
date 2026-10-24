/**
 * strategyHubAi.ts — the two AI jobs on a Strategy Hub tool, as pure prompt builders and parsers (the routes do the
 * session check, the model call and the saving):
 *
 *   • "Update with AI"  — draft the parts of the framework the client has NOT answered themselves (generate route),
 *   • "Analyse"         — write the analysis, recommendations and actionables from the filled-in answers (analyze route).
 *
 * Both work from a framework's STRUCTURE (strategyModels): for a framework with a model, the AI is told each element's own
 * definition and the form it must come back in (a choice from the allowed options, a 1–5 rating, rows for a table), and what
 * it returns is validated against that — an invalid choice or an out-of-range rating is dropped, never saved. A framework with
 * no model is a single section of long-text fields, handled by the same code.
 *
 * Both are grounded in the client's Business Context, latest Value Scan and the saved work from the tools this one builds on
 * (strategyHubConnections.ts), and both run the framework's own editable methodology (strategyHubSkill.ts), so an admin's edit
 * to "how the analysis is done" changes what is generated.
 *
 * No length limits anywhere in these prompts: the client's field values are sent in full and the model is told there is no
 * limit on its own output.
 */
import type { FrameworkField, StrategyFrameworkRow } from './strategyFrameworks';
import {
  normaliseActionables,
  normaliseAnalysis,
  normaliseRecommendations,
  type StrategyActionable,
  type StrategyAnalysis,
  type StrategyRecommendation,
} from './strategyFillinTypes';
import { matchOption } from './templateKit/values';
import {
  cleanTable,
  expandTable,
  fieldsFromValues,
  fmtNum,
  isBlankRow,
  isBlankSaved,
  labelColumnKey,
  norm as normLabel,
  parseRows,
  partsOf,
  renderValuesForPrompt,
  toNum,
  typedColumns,
  valuesFromFields,
} from './strategyModels/values';
import { isField, isTable, type Column, type FieldPart, type Part, type Row, type Structure, type TablePart } from './strategyModels/types';

export interface ClientField { label: string; value: string; source?: string }

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

const asFrameworkFields = (fs: ClientField[]): FrameworkField[] => fs.map((f) => ({ label: f.label, value: f.value, source: f.source || 'Manual' }));

/** The source badge the AI's own writing carries, so a later "Update with AI" knows it may re-draft it. */
export const AI_SOURCE = 'AI';

/**
 * The client's fields as the structure's own: answers saved under an earlier label are carried to the part they now belong to,
 * table rows are tidied, and every part is present in order. Used for what was saved long ago as well as what was just posted.
 */
export function canonicaliseClientFields(structure: Structure & { legacyLabels?: Record<string, string> }, fields: ClientField[]): ClientField[] {
  const parsed = valuesFromFields(structure, asFrameworkFields(fields));
  return fieldsFromValues(structure, parsed.values, parsed.sources);
}

/** Cleans a client-posted fields payload: objects with a label, string values, a source (Manual when none). */
export function cleanClientFields(raw: unknown): ClientField[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((f): f is Record<string, unknown> => !!f && typeof f === 'object')
    .map((f) => ({ label: String(f.label ?? ''), value: String(f.value ?? ''), source: String(f.source ?? '').trim() || 'Manual' }))
    .filter((f) => f.label.trim().length > 0);
}

/** For a table whose rows are the model's own (the five forces, the four strategies): the names of the rows with nothing in them yet. */
export function blankFixedRows(part: TablePart, value: string | undefined): string[] {
  if (!part.fixedRows) return [];
  const key = labelColumnKey(part);
  return expandTable(part, parseRows(value ?? '')).filter((r) => isBlankRow(part, r)).map((r) => r[key]);
}

/**
 * Which of the framework's fields the AI may write: there is no answer yet, it is blank, or the AI wrote it earlier (so
 * "Update with AI" can re-draft its own work). A field the client typed, imported or confirmed is never touched. With a
 * structure, a table counts as unanswered when it has no rows with data — and a table of the model's own rows the client has
 * only partly answered can still have its empty rows drafted (the rows they filled in stay exactly as they are).
 */
export function fillableLabels(framework: Pick<StrategyFrameworkRow, 'fields'>, current: ClientField[], structure?: Pick<Structure, 'sections'>): string[] {
  const byLabel = new Map(current.map((f) => [f.label, f]));
  const partByLabel = new Map((structure ? partsOf(structure) : []).map((p) => [normLabel(p.label), p]));
  return framework.fields
    .map((f) => f.label)
    .filter((label) => {
      const c = byLabel.get(label);
      if (!c) return true;
      if (c.source === AI_SOURCE) return true;
      const part = partByLabel.get(normLabel(label));
      if (!part) return !c.value.trim();
      if (isBlankSaved(part, c.value)) return true;
      return isTable(part) && blankFixedRows(part, c.value).length > 0;
    });
}

/** Rows the client already answered, then the model's own rows they left empty from the AI's draft. */
function mergeFixedRows(part: TablePart, own: string, drafted: string): string {
  const key = labelColumnKey(part);
  const ownRows = new Map(cleanTable(part, parseRows(own)).map((r) => [normLabel(r[key] ?? ''), r]));
  const aiRows = new Map(cleanTable(part, parseRows(drafted)).map((r) => [normLabel(r[key] ?? ''), r]));
  const merged = (part.fixedRows ?? []).flatMap((name) => { const r = ownRows.get(normLabel(name)) ?? aiRows.get(normLabel(name)); return r ? [r] : []; });
  return JSON.stringify(cleanTable(part, merged));
}

/** The source shown on a table the client started and the AI finished. */
export const MIXED_SOURCE = 'Manual + AI';

export interface PromptContext {
  contextBlock: string;
  valueScanBlock: string;
  upstreamBlock: string;
}

const NO_CONTEXT = 'No business context or Value Scan report is on file for this client yet — use realistic assumptions for a typical Indian MSME and keep values general enough to still be useful.';

// ── Describing a part to the AI, and validating what comes back ──────────────

const scaleText = (s: { min: number; max: number; low: string; high: string }): string => `a whole number from ${s.min} (${s.low}) to ${s.max} (${s.high})`;

function columnDescription(c: Column): string {
  const kind =
    c.type === 'select' ? `one of: ${(c.options ?? []).join(' | ')}`
    : c.type === 'rating' ? scaleText(c.scale!)
    : c.type === 'number' ? `a number${c.unit ? ` (${c.unit})` : ''}`
    : c.type === 'longtext' ? 'a sentence or two'
    : 'short text';
  return `"${c.key}" (${kind}) — ${c.header}: ${c.help}`;
}

export function describePart(index: number, part: Part, onlyRows?: string[]): string {
  if (isTable(part)) {
    const cols = typedColumns(part).filter((c, i) => !(part.fixedRows && i === 0));
    const names = onlyRows && onlyRows.length > 0 ? onlyRows : part.fixedRows;
    const rowsRule = part.fixedRows
      ? `Exactly one row for each of: ${(names ?? []).map((r) => `"${r}"`).join(', ')}; put the row name in "${labelColumnKey(part)}".${onlyRows && onlyRows.length > 0 ? ' The other rows are already answered by the client (see their answers) — leave them out.' : ''}`
      : `Up to ${part.maxRows} rows, one per ${part.rowLabel.toLowerCase()}.`;
    return `${index}. "${part.label}" — ${part.help} This is a TABLE: reply under "tables" with {"label":"${part.label}","rows":[…]}. ${rowsRule} Each row is an object with the keys: ${cols.map(columnDescription).join('; ')}.`;
  }
  const kind =
    part.type === 'select' ? `choose exactly one of: ${(part.options ?? []).join(' | ')}`
    : part.type === 'rating' ? scaleText(part.scale!)
    : part.type === 'number' ? `a number${part.unit ? ` (${part.unit})` : ''}`
    : part.type === 'longtext' ? 'a few specific sentences' : 'a short phrase';
  return `${index}. "${part.label}" — ${part.help} (${kind})`;
}

function coerceValue(type: string, raw: unknown, options?: readonly string[], scale?: { min: number; max: number }): string {
  if (raw === null || raw === undefined) return '';
  if (type === 'select') return options ? (matchOption(raw, options) ?? '') : '';
  if (type === 'rating') {
    const n = toNum(typeof raw === 'string' ? (raw.match(/-?\d+(\.\d+)?/)?.[0] ?? '') : raw);
    if (n === null || !scale) return '';
    const r = Math.round(n);
    return r >= scale.min && r <= scale.max ? String(r) : '';
  }
  if (type === 'number') { const n = toNum(raw); return n === null ? '' : fmtNum(n, 4); }
  return typeof raw === 'string' ? raw.trim() : String(raw).trim();
}

const coerceField = (p: FieldPart, raw: unknown): string => coerceValue(p.type, raw, p.options, p.scale);

/** A table's rows from whatever the model returned, validated cell by cell; the saved JSON, or '' when nothing usable. */
function coerceRows(part: TablePart, raw: unknown): string {
  let rows: unknown = raw;
  if (typeof raw === 'string') rows = parseRows(raw);
  if (!Array.isArray(rows)) return '';
  const cols = typedColumns(part);
  const built: Row[] = [];
  for (const r of rows) {
    if (!r || typeof r !== 'object' || Array.isArray(r)) continue;
    const o = r as Record<string, unknown>;
    const row: Row = {};
    for (const c of cols) {
      const v = coerceValue(c.type, o[c.key], c.options, c.scale);
      if (v) row[c.key] = v;
    }
    built.push(row);
  }
  if (part.fixedRows) {
    const key = labelColumnKey(part);
    const byName = new Map(part.fixedRows.map((n) => [norm(n), n]));
    const aligned: Row[] = [];
    for (const r of built) { const name = byName.get(norm(r[key] ?? '')); if (name) aligned.push({ ...r, [key]: name }); }
    const cleaned = cleanTable(part, aligned);
    return cleaned.length ? JSON.stringify(cleaned) : '';
  }
  const cleaned = cleanTable(part, built);
  return cleaned.length ? JSON.stringify(cleaned) : '';
}

// ── Generate ("Update with AI") ──────────────────────────────────────────────

export function buildGenerateMessages(args: {
  framework: Pick<StrategyFrameworkRow, 'name' | 'layer' | 'fields'>;
  structure?: Structure;
  methodology: string;
  fillable: string[];
  current: ClientField[];
  ctx: PromptContext;
}): { system: string; user: string } {
  const { framework, structure, methodology, fillable, current, ctx } = args;
  const partByLabel = new Map((structure ? partsOf(structure) : []).map((p) => [normLabel(p.label), p]));
  const currentByLabel = new Map(current.map((f) => [f.label, f]));
  const fieldList = fillable.map((label, i) => {
    const part = partByLabel.get(normLabel(label));
    if (!part) return `${i + 1}. "${label}"`;
    // A table the client has partly answered: only the rows still empty are drafted.
    const c = currentByLabel.get(label);
    const partial = isTable(part) && !!c && c.source !== AI_SOURCE && !isBlankSaved(part, c.value);
    return describePart(i + 1, part, partial ? blankFixedRows(part, c!.value) : undefined);
  }).join('\n');
  const hasTables = fillable.some((l) => partByLabel.get(normLabel(l)) && isTable(partByLabel.get(normLabel(l))!));
  const shape = hasTables
    ? '{"fields":[{"label":"<exact label>","value":"<drafted value>"}],"tables":[{"label":"<exact label>","rows":[{…}]}]}'
    : '{"fields":[{"label":"<exact label>","value":"<drafted value>"}]}';
  const system =
    `You are a senior MSME strategy consultant filling in the "${framework.name}" strategy framework (layer: ${framework.layer}), following this admin-approved methodology precisely:\n\n${methodology}\n\n---\n\n` +
    `Draft realistic, specific, DETAILED answers for ONLY the elements listed at the end of this message, grounded in the evidence in the user message: the client's own Business Context, their latest Value Scan, the saved work from the tools this one builds on, and the answers they have already given. Never use placeholders like "TBD" or "N/A", and never a short generic sentence where a longer, evidence-grounded one is warranted. There is NO length limit on any value. If an element genuinely needs a number you cannot know (e.g. an exact percentage), give a plausible estimate consistent with the evidence and phrase it as an estimate. Follow each element's own definition and the form given in brackets exactly.\n\n` +
    `The client's own answers (listed in the user message) are fixed: use them as context, and never repeat or change them.\n\n` +
    `Output ONLY a JSON object shaped ${shape} with exactly one entry per element listed below, in the same order, using the exact label text given verbatim. No markdown, no commentary, no code fences.\n\n` +
    `Elements to draft:\n${fieldList}`;

  // The client's own answers are context — including the rows they filled in on a table the AI is only finishing. (A fillable
  // field that is not the AI's own and not blank can only be such a table.)
  const owned = current.filter((f) => f.value.trim() && f.source !== AI_SOURCE);
  let given: string;
  if (structure) {
    const parsed = valuesFromFields(structure, asFrameworkFields(owned));
    given = renderValuesForPrompt(structure, parsed.values, { skipBlank: true });
  } else {
    given = owned.map((f) => `- ${f.label}: ${f.value.trim()}`).join('\n');
  }
  const user = [
    ctx.contextBlock,
    ctx.valueScanBlock,
    ctx.upstreamBlock,
    given.trim() ? `ANSWERS ALREADY GIVEN BY THE CLIENT (fixed — context only):\n${given}` : '',
    !ctx.contextBlock && !ctx.valueScanBlock && !ctx.upstreamBlock ? NO_CONTEXT : '',
  ].filter(Boolean).join('\n\n');
  return { system, user };
}

/**
 * label → drafted value, for labels the AI was asked about only. With a structure each value is validated against its element
 * (a choice must be an allowed option, a rating in range, a table's rows well-formed) and an invalid one is dropped. Throws on
 * output that is not JSON.
 */
export function parseGenerated(text: string, fillable: string[], structure?: Pick<Structure, 'sections'>): Map<string, string> {
  const parsed = JSON.parse(text) as { fields?: unknown; tables?: unknown };
  const byNorm = new Map(fillable.map((l) => [norm(l), l]));
  const partByLabel = new Map((structure ? partsOf(structure) : []).map((p) => [normLabel(p.label), p]));
  const out = new Map<string, string>();

  const accept = (label: unknown, raw: unknown) => {
    if (typeof label !== 'string') return;
    const canonical = byNorm.get(norm(label));
    if (!canonical) return;
    const part = partByLabel.get(normLabel(canonical));
    let v: string;
    if (part && isTable(part)) v = coerceRows(part, raw);
    else if (part && isField(part)) v = coerceField(part, raw);
    else v = raw === null || raw === undefined ? '' : String(raw).trim();
    if (v) out.set(canonical, v);
  };

  if (Array.isArray(parsed.fields)) {
    for (const f of parsed.fields) { if (f && typeof f === 'object') accept((f as { label?: unknown }).label, (f as { value?: unknown }).value); }
  }
  if (Array.isArray(parsed.tables)) {
    for (const t of parsed.tables) { if (t && typeof t === 'object') accept((t as { label?: unknown }).label, (t as { rows?: unknown }).rows); }
  }
  return out;
}

/**
 * The full field list after an AI fill: every framework field, in the framework's order — the AI's draft where it was
 * allowed to write one, the client's existing answer everywhere else.
 */
export function mergeGenerated(
  framework: Pick<StrategyFrameworkRow, 'fields'>,
  current: ClientField[],
  fillable: string[],
  generated: Map<string, string>,
  structure?: Pick<Structure, 'sections'>
): FrameworkField[] {
  const byLabel = new Map(current.map((f) => [f.label, f]));
  const mayFill = new Set(fillable);
  const partByLabel = new Map((structure ? partsOf(structure) : []).map((p) => [normLabel(p.label), p]));
  return framework.fields.map((def) => {
    const drafted = mayFill.has(def.label) ? generated.get(def.label) : undefined;
    const c = byLabel.get(def.label);
    if (drafted) {
      const part = partByLabel.get(normLabel(def.label));
      // A table of the model's own rows the client started: their rows stay as they typed them, the AI adds the rest.
      if (part && isTable(part) && part.fixedRows && c && c.source !== AI_SOURCE && !isBlankSaved(part, c.value)) {
        return { label: def.label, value: mergeFixedRows(part, c.value, drafted), source: MIXED_SOURCE };
      }
      return { label: def.label, value: drafted, source: AI_SOURCE };
    }
    return { label: def.label, value: c?.value ?? '', source: c?.source || 'Manual' };
  });
}

// ── Analyse ──────────────────────────────────────────────────────────────────

export function buildAnalyzeMessages(args: {
  framework: Pick<StrategyFrameworkRow, 'name' | 'layer'>;
  structure?: Structure;
  analysisGuide?: string;
  methodology: string;
  fields: ClientField[];
  ctx: PromptContext;
}): { system: string; user: string } {
  const { framework, structure, analysisGuide, methodology, fields, ctx } = args;
  const system =
    `You are a senior strategy consultant producing the final Analysis, Recommendations & Actionables for a completed "${framework.name}" strategy framework (layer: ${framework.layer}) for an Indian MSME client.\n\n` +
    `METHODOLOGY FOR THIS FRAMEWORK (follow this precisely — it is the admin-approved analytical approach for this specific tool):\n${methodology}\n\n` +
    (analysisGuide ? `HOW TO REACH THIS MODEL'S VERDICT:\n${analysisGuide}\n\n` : '') +
    `RULES:\n` +
    `- Ground everything in the client's actual filled-in answers below — never generic advice that could apply to any business. Cite the actual figures and facts from the answers where relevant.\n` +
    `- If saved work from earlier tools in the golden thread is given, treat it as established: stay consistent with it, and say so explicitly if you depart from it.\n` +
    `- Where the answers include figures the model has already worked out (shown under "Figures worked out"), use them as they are rather than recomputing.\n` +
    `- There is NO length limit. Be as detailed and specific as the analysis genuinely warrants — a longer, well-evidenced answer is always better than a short generic one.\n` +
    `- "analysis.summary": 3-5 plain-language sentences saying what the completed framework tells this business.\n` +
    `- "analysis.verdict": the framework's headline conclusion as {"label":"<short, e.g. 'Moderately attractive industry'>","rationale":"<one or two sentences why>"}; use null only if the framework has no single verdict.\n` +
    `- "analysis.findings": 3-6 objects {"title":"...","detail":"..."} — the specific things the answers reveal (strongest signal, biggest gap, a contradiction, a dependency).\n` +
    `- "analysis.watchouts": 2-5 strings — assumptions worth challenging, evidence that is missing, risks to the conclusion.\n` +
    `- "recommendations": 3-6 objects {"text":"..."}, each a specific, evidence-grounded strategic recommendation with enough detail to act on.\n` +
    `- "actionables": 3-8 objects {"action":"...","owner":"...","timeframe":"...","priority":"High"|"Medium"|"Low"}. "action" must be concrete (not "improve X" but exactly what to do). "owner" is a realistic role (e.g. "Finance Head", "Founder", "Sales Lead"). "timeframe" is specific (e.g. "Next 30 days", "This quarter").\n\n` +
    `Output ONLY a JSON object shaped {"analysis":{"summary":"...","verdict":{"label":"...","rationale":"..."},"findings":[{"title":"...","detail":"..."}],"watchouts":["..."]},"recommendations":[{"text":"..."}],"actionables":[{"action":"...","owner":"...","timeframe":"...","priority":"..."}]}. No markdown, no commentary, no code fences.`;

  const answers = structure
    ? renderValuesForPrompt(structure, valuesFromFields(structure, asFrameworkFields(fields)).values)
    : fields.map((f) => `- ${f.label}: ${f.value.trim() ? f.value : '(left blank)'}`).join('\n');
  const user = [`COMPLETED FIELDS FOR "${framework.name}":\n${answers}`, ctx.upstreamBlock, ctx.contextBlock, ctx.valueScanBlock].filter(Boolean).join('\n\n');
  return { system, user };
}

export interface ParsedAnalysis {
  analysis: StrategyAnalysis | null;
  recommendations: StrategyRecommendation[];
  actionables: StrategyActionable[];
}

/** Throws on output that is not JSON; returns empty parts for anything unusable (the route decides if that is an error). */
export function parseAnalysis(text: string): ParsedAnalysis {
  const parsed = JSON.parse(text) as Record<string, unknown>;
  return {
    analysis: normaliseAnalysis(parsed.analysis),
    recommendations: normaliseRecommendations(parsed.recommendations),
    actionables: normaliseActionables(parsed.actionables),
  };
}

export const hasAnyOutput = (p: ParsedAnalysis): boolean => !!p.analysis || p.recommendations.length > 0 || p.actionables.length > 0;

