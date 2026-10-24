// FUTURESKILZ ADAPTATION of the Strategy Hub's content bar (strategyModelsContent.test.ts, commit f9c3ab4): the same checks,
// run over the Problem Solving section's definitions, samples, diagrams and workbooks.
import { describe, expect, it, vi } from 'vitest';

vi.mock('../lib/mysql', () => ({ default: { query: vi.fn() } }));

import { PROBLEM_SOLVING_SEED as ALL_SEED } from '../lib/problemSolving/seed';
import { EXPECTED_ON_DIAGRAM, OUTPUTS, PREFILLS, type ToolId } from '../lib/problemSolving/thread';
import { ALL_MODELS, getModelDefinition, getModelDiagramSvg, getModelSample } from '../lib/strategyModels/registry';
import { MODEL_GROUPS, modelToolIds } from '../lib/strategyModels/groups';
import { DEFINE_MODELS } from '../lib/strategyModels/defs/define';
import { ANALYSE_MODELS } from '../lib/strategyModels/defs/analyse';
import {
  cleanTable,
  computeDerived,
  computeOutputs,
  fieldsFromValues,
  flattenStructure,
  norm,
  partsOf,
  toNum,
  valuesFromFields,
  parseLegacyTarget,
  typedColumns,
  labelColumnKey,
} from '../lib/strategyModels/values';
import { strategyKit } from '../lib/strategyModels/kit';
import { kitBytes } from '../lib/templateKit/workbook';
import { readKitWorkbook } from '../lib/templateKit/read';
import { normaliseActionables, normaliseAnalysis } from '../lib/strategyFillinTypes';
import { effectiveLinks } from '../lib/strategyFrameworkLinks';
import { isField, isTable, type ModelDefinition, type ModelSample, type ModelValues, type Part } from '../lib/strategyModels/types';

const seedOf = (toolId: string) => ALL_SEED.find((s) => s.toolId === toolId);
const fieldsOfSeed = (toolId: string) => { const d = getModelDefinition(toolId); return d ? flattenStructure(d) : []; };
const LINKS = effectiveLinks(ALL_SEED);
const sampleValues = (s: ModelSample): ModelValues => ({ fields: { ...s.values }, tables: { ...s.tables } });

/** What a diagram says, in reading order: every <text>, whitespace-collapsed. */
function diagramText(svg: string): string {
  return [...svg.matchAll(/<text\b[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]).join(' ').replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'").replace(/\s+/g, ' ').toLowerCase();
}

/** Minimal well-formedness check: every tag opened is closed, in order. */
function wellFormed(svg: string): boolean {
  const stack: string[] = [];
  for (const m of svg.matchAll(/<(\/?)([a-zA-Z][\w:-]*)\b[^>]*?(\/?)>/g)) {
    const [, closing, name, selfClosing] = m;
    if (selfClosing) continue;
    if (!closing) stack.push(name);
    else if (stack.pop() !== name) return false;
  }
  return stack.length === 0;
}

/** Numbers compared as numbers ("1.0" equals "1"), everything else as trimmed text. */
const canon = (v: string | undefined): string => { const n = toNum(v); return n !== null && /^[\s\d.,()₹%×-]+$/.test(v ?? '') ? String(n) : (v ?? '').trim(); };

describe('the registry is in step with the group list', () => {
  it('lists every converted tool once, in the group its definitions live in', () => {
    const fromModules: Record<string, string[]> = {
      define: DEFINE_MODELS.map((m) => m.toolId),
      analyse: ANALYSE_MODELS.map((m) => m.toolId),
    };
    for (const g of Object.keys(MODEL_GROUPS)) expect([...MODEL_GROUPS[g as keyof typeof MODEL_GROUPS]].sort()).toEqual([...fromModules[g]].sort());
    expect(modelToolIds().sort()).toEqual(ALL_MODELS.map((m) => m.toolId).sort());
    expect(new Set(ALL_MODELS.map((m) => m.toolId)).size).toBe(ALL_MODELS.length);
  });

  it('every converted tool exists in the catalogue seed', () => {
    for (const m of ALL_MODELS) expect(seedOf(m.toolId), m.toolId).toBeTruthy();
  });
});

// FUTURESKILZ: the words each diagram must say come from the section's thread data (problemSolving/thread.ts).

describe('the definitions agree with the section thread', () => {
  it('declares exactly the outputs the thread names, and the prefills the thread names', () => {
    for (const m of ALL_MODELS) {
      expect(m.outputs.map((o) => o.key), m.toolId).toEqual(OUTPUTS[m.toolId as ToolId]);
      const declared = partsOf(m).filter(isField).flatMap((p) => (p.prefill && typeof p.prefill !== 'string' ? [{ field: p.key, from: p.prefill.upstream, output: p.prefill.output }] : []));
      const expected = PREFILLS.filter((x) => x.tool === m.toolId && modelToolIds().includes(x.from)).map(({ field, from, output }) => ({ field, from, output }));
      expect(declared, m.toolId).toEqual(expected);
    }
  });
});

/** Fixed tables whose rows are data (years, statement lines), not the model's own elements, so the diagram need not name them. */
const DATA_TABLES: Record<string, string[]> = {};

describe.each(ALL_MODELS.map((m) => [m.toolId, m] as const))('%s', (toolId, def: ModelDefinition) => {
  const parts: Part[] = partsOf(def);
  const sample = getModelSample(toolId);

  describe('the definition', () => {
    it('has a reference with an originator, a summary, a caption and two to four reading notes', () => {
      const r = def.reference;
      for (const k of ['originator', 'summary', 'caption'] as const) expect(r[k].trim().length, k).toBeGreaterThan(8);
      expect(r.year.trim().length).toBeGreaterThanOrEqual(4);
      expect(r.howToRead.length).toBeGreaterThanOrEqual(2);
      expect(r.howToRead.length).toBeLessThanOrEqual(4);
      expect(def.analysisGuide.trim().length).toBeGreaterThan(80);
    });

    it('has unique part keys and labels, every part explained and exemplified', () => {
      expect(new Set(parts.map((p) => p.key)).size).toBe(parts.length);
      expect(new Set(parts.map((p) => norm(p.label))).size).toBe(parts.length);
      expect(def.sections.length).toBeGreaterThan(0);
      for (const s of def.sections) { expect(s.parts.length, s.key).toBeGreaterThan(0); expect(s.title.trim()).toBeTruthy(); }
      for (const p of parts) {
        expect(p.help.trim().length, `${p.key} help`).toBeGreaterThan(10);
        if (isField(p)) {
          expect(typeof p.example).toBe('string');
          if (p.type === 'select') expect(p.options?.length, p.key).toBeGreaterThanOrEqual(2);
          if (p.type === 'rating') expect(p.scale!.max).toBeGreaterThan(p.scale!.min);
          if (p.type === 'number') expect(p.unit, p.key).toBeTruthy();
        }
      }
    });

    it('describes each table consistently', () => {
      for (const t of parts.filter(isTable)) {
        const keys = t.columns.map((c) => c.key);
        expect(new Set(keys).size, t.key).toBe(keys.length);
        expect(typedColumns(t).length, t.key).toBeGreaterThan(1);
        for (const c of t.columns) {
          expect(c.help.trim().length, `${t.key}.${c.key}`).toBeGreaterThan(5);
          if (c.type === 'select') expect(c.options?.length, c.key).toBeGreaterThanOrEqual(2);
          if (c.type === 'computed') expect(typeof c.compute, c.key).toBe('function');
        }
        expect(t.maxRows).toBeGreaterThanOrEqual(t.minRows);
        if (t.fixedRows) {
          expect(t.columns[0].type).toBe('text');
          expect(t.minRows).toBe(t.fixedRows.length);
          expect(t.maxRows).toBe(t.fixedRows.length);
          for (const h of Object.keys(t.rowHints ?? {})) expect(t.fixedRows, `hint for ${h}`).toContain(h);
        }
        for (const k of Object.keys(t.exampleRow ?? {})) expect(keys, k).toContain(k);
      }
    });

    it('has unique derived and output keys', () => {
      expect(new Set(def.derived.map((d) => d.key)).size).toBe(def.derived.length);
      expect(new Set(def.outputs.map((o) => o.key)).size).toBe(def.outputs.length);
      expect(def.outputs.length).toBeGreaterThan(0);
    });

    it('carries every answer the earlier version of the tool could have saved', () => {
      const keys = new Set(parts.map((p) => p.key));
      for (const [label, target] of Object.entries(def.legacyLabels ?? {})) {
        const t = parseLegacyTarget(target);
        expect(keys, `${label} → ${target}`).toContain(t.key);
        if (t.row !== undefined) {
          const table = parts.find((p) => p.key === t.key);
          expect(table && isTable(table), `${target} must address a table`).toBeTruthy();
          if (table && isTable(table)) {
            if (table.fixedRows) expect(table.fixedRows, `${target}: row`).toContain(t.row);
            else {
              expect(t.row, `${target}: a table of free rows is addressed by position`).toMatch(/^\d+$/);
              expect(Number(t.row), `${target}: position`).toBeGreaterThanOrEqual(1);
              expect(Number(t.row), `${target}: position`).toBeLessThanOrEqual(table.maxRows);
            }
            expect(table.columns.find((c) => c.key === t.col && c.type !== 'computed'), `${target}: column`).toBeTruthy();
          }
        }
      }
      const labels = new Set(parts.map((p) => norm(p.label)));
      const legacy = new Map(Object.entries(def.legacyLabels ?? {}).map(([l, k]) => [norm(l), k]));
      for (const f of fieldsOfSeed(toolId)) expect(labels.has(norm(f.label)) || legacy.has(norm(f.label)), `legacy field "${f.label}" has no home`).toBe(true);
    });

    it('draws prefill suggestions only from tools it builds on, and from outputs that exist', () => {
      const upstream = new Set(LINKS.get(toolId)!.upstream);
      for (const p of parts) {
        if (!isField(p) || !p.prefill || typeof p.prefill === 'string') continue;
        expect(upstream, `${p.key} ← ${p.prefill.upstream}`).toContain(p.prefill.upstream);
        const from = getModelDefinition(p.prefill.upstream);
        if (from) expect(from.outputs.map((o) => o.key), `${p.prefill.upstream}.${p.prefill.output}`).toContain(p.prefill.output);
      }
    });

    it('flattens to one catalogue field per part, in order', () => {
      const flat = flattenStructure(def);
      expect(flat.map((f) => f.label)).toEqual(parts.map((p) => p.label));
    });
  });

  describe('the reference diagram', () => {
    const svg = getModelDiagramSvg(toolId);
    it('exists, is well-formed, accessible and free of drawing accidents', () => {
      expect(svg, 'diagram').toBeTruthy();
      expect(svg!.startsWith('<svg')).toBe(true);
      expect(svg!.endsWith('</svg>')).toBe(true);
      expect(wellFormed(svg!)).toBe(true);
      expect(svg).toContain('viewBox="0 0 720 440"');
      expect(svg).toMatch(/<title id="dg-title">[^<]{4,}<\/title>/);
      expect(svg).toMatch(/<desc id="dg-desc">[^<]{40,}<\/desc>/);
      expect(svg).not.toMatch(/NaN|undefined|\[object/);
      for (const m of svg!.matchAll(/font-size="([\d.]+)"/g)) expect(Number(m[1])).toBeGreaterThanOrEqual(9.5);
    });

    it('is drawn the same way every time', () => {
      expect(getModelDiagramSvg(toolId)).toBe(svg);
    });

    it('shows the model\'s own elements by name, so the picture and the form cannot disagree', () => {
      const said = diagramText(svg!);
      const expected = EXPECTED_ON_DIAGRAM[toolId as ToolId];
      expect(expected, `add the expected labels for ${toolId} to this test`).toBeTruthy();
      for (const label of expected) expect(said, label).toContain(label);
      for (const t of parts.filter(isTable)) {
        if (DATA_TABLES[toolId]?.includes(t.key)) continue; // a table of figures (a trend), not an element of the model
        for (const row of t.fixedRows ?? []) expect(said, `row "${row}"`).toContain(row.toLowerCase());
      }
    });
  });

  describe('the worked example', () => {
    it('exists and is about the fictional company', () => {
      expect(sample, 'sample').toBeTruthy();
      expect(sample!.scenario).toContain('Anand Auto Components');
    });

    it('answers every part, with values the model allows', () => {
      const s = sample!;
      for (const p of parts) {
        if (isField(p)) {
          const v = s.values[p.key];
          if (p.key !== 'notes') expect((v ?? '').trim().length, `${p.key} is answered`).toBeGreaterThan(0);
          if (!v) continue;
          if (p.type === 'select') expect(p.options, p.key).toContain(v);
          if (p.type === 'rating') { const n = Number(v); expect(Number.isInteger(n) && n >= p.scale!.min && n <= p.scale!.max, `${p.key}=${v}`).toBe(true); }
          if (p.type === 'number') expect(toNum(v), p.key).not.toBeNull();
        } else {
          const rows = s.tables[p.key] ?? [];
          expect(rows.length, `${p.key} has rows`).toBeGreaterThanOrEqual(p.fixedRows ? p.fixedRows.length : Math.min(2, p.maxRows));
          expect(rows.length).toBeLessThanOrEqual(p.maxRows);
          expect(cleanTable(p, rows), `${p.key} rows survive cleaning`).toHaveLength(rows.length);
          for (const r of rows) {
            for (const c of typedColumns(p)) {
              const v = r[c.key];
              if (!v) continue;
              if (c.type === 'select') expect(c.options, `${p.key}.${c.key}=${v}`).toContain(v);
              if (c.type === 'rating') { const n = Number(v); expect(Number.isInteger(n) && n >= c.scale!.min && n <= c.scale!.max, `${p.key}.${c.key}=${v}`).toBe(true); }
              if (c.type === 'number') expect(toNum(v), `${p.key}.${c.key}=${v}`).not.toBeNull();
            }
          }
          if (p.fixedRows) expect(rows.map((r) => r[labelColumnKey(p)]).sort()).toEqual([...p.fixedRows].sort());
        }
      }
      for (const k of Object.keys(s.values)) expect(parts.find((p) => p.key === k && isField(p)), `values.${k}`).toBeTruthy();
      for (const k of Object.keys(s.tables)) expect(parts.find((p) => p.key === k && isTable(p)), `tables.${k}`).toBeTruthy();
      for (const k of Object.keys(s.why)) expect(parts.some((p) => p.key === k), `why.${k}`).toBe(true);
      expect(Object.keys(s.why).length).toBeGreaterThanOrEqual(2);
    });

    it('carries a real analysis: a verdict, findings, watch-outs, recommendations and actionables', () => {
      const s = sample!;
      const a = normaliseAnalysis(s.analysis);
      expect(a).not.toBeNull();
      expect(a!.summary.length).toBeGreaterThan(80);
      expect(a!.verdict?.label.length).toBeGreaterThan(5);
      expect(a!.verdict?.rationale.length).toBeGreaterThan(20);
      expect(a!.findings.length).toBeGreaterThanOrEqual(3);
      expect(a!.findings.every((f) => f.title && f.detail.length > 20)).toBe(true);
      expect(a!.watchouts.length).toBeGreaterThanOrEqual(2);
      expect(s.recommendations.length).toBeGreaterThanOrEqual(3);
      expect(s.recommendations.every((r) => r.length > 40)).toBe(true);
      expect(normaliseActionables(s.actionables)).toHaveLength(s.actionables.length);
      expect(s.actionables.length).toBeGreaterThanOrEqual(3);
      expect(new Set(s.actionables.map((x) => x.priority)).has('High')).toBe(true);
    });

    it('uses no placeholder text', () => {
      const all = JSON.stringify(sample);
      expect(all).not.toMatch(/\bTBD\b|lorem ipsum|\bTODO\b|\bXXX\b|N\/A/i);
    });

    it('works out its figures and its outputs from the answers', () => {
      const v = sampleValues(sample!);
      for (const d of computeDerived(def, v)) expect(d.value, `derived ${d.key}`).not.toBeNull();
      const got = computeOutputs(def, v).map((o) => o.key);
      for (const o of def.outputs) if (!o.conditional) expect(got, `output ${o.key}`).toContain(o.key);
      for (const k of got) expect(def.outputs.map((o) => o.key), k).toContain(k);
    });

    it('survives being saved and read back, field by field', () => {
      const v = sampleValues(sample!);
      const saved = fieldsFromValues(def, v, {});
      const back = valuesFromFields(def, saved);
      for (const p of parts) {
        if (isField(p)) expect(back.values.fields[p.key] ?? '', p.key).toBe(v.fields[p.key] ?? '');
        else expect(back.values.tables[p.key] ?? [], p.key).toEqual(cleanTable(p, v.tables[p.key]));
      }
    });
  });

  describe('the template, the sample workbook and the importer', () => {
    const kit = strategyKit({ toolId, name: def.reference.originator.slice(0, 20) || toolId, structure: def });

    it('builds a blank template that reads back empty and is not mistaken for a sample', async () => {
      const read = await readKitWorkbook(kit.def, await kitBytes(kit.def, null));
      expect(read.isSample).toBe(false);
      expect(read.warnings).toEqual([]);
      const back = kit.fromContent(read.content);
      expect(Object.keys(back.fields)).toEqual([]);
      expect(Object.keys(back.tables)).toEqual([]);
    });

    it('builds a sample workbook that is recognised as one and reads back to the worked example', async () => {
      const v = sampleValues(sample!);
      const read = await readKitWorkbook(kit.def, await kitBytes(kit.def, kit.toContent(v)));
      expect(read.isSample).toBe(true);
      expect(read.warnings).toEqual([]);
      const back = kit.fromContent(read.content);
      for (const p of parts) {
        if (isField(p)) expect(canon(back.fields[p.key]), p.key).toBe(canon(v.fields[p.key]));
        else {
          const want = cleanTable(p, v.tables[p.key]).map((r) => Object.fromEntries(Object.entries(r).map(([k, x]) => [k, canon(x)])));
          const got = (back.tables[p.key] ?? []).map((r) => Object.fromEntries(Object.entries(r).map(([k, x]) => [k, canon(x)])));
          expect(got, p.key).toEqual(want);
        }
      }
    });

    it('gives every sheet a legal, unique name', () => {
      const names = kit.def.sheets.map((s) => s.name);
      expect(new Set(names.map(norm)).size).toBe(names.length);
      for (const n of names) { expect(n.length).toBeLessThanOrEqual(31); expect(n).not.toMatch(/[[\]:*?/\\]/); }
    });
  });
});
