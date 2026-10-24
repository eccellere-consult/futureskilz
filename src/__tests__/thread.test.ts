/**
 * thread.test.ts — the Problem Solving thread is consistent with the engine's own rules, before any framework is written. A builder copies the
 * data in thread.ts into the seed and the definitions; if these checks pass, the links, suggestions and stages can not contradict each other.
 */
import { describe, expect, it } from 'vitest';
import { effectiveLinks } from '../lib/strategyFrameworkLinks';
import { EXPECTED_ON_DIAGRAM, FEEDS, OUTPUTS, PREFILLS, STAGES, STAGE_OF, TOOL_IDS, type ToolId } from '../lib/problemSolving/thread';

const rows = TOOL_IDS.map((id) => ({ toolId: id, upstreamTools: [] as string[], downstreamTools: FEEDS[id] as string[] }));
const links = effectiveLinks(rows);
const upstreamOf = (id: ToolId) => links.get(id)!.upstream;
const downstreamOf = (id: ToolId) => links.get(id)!.downstream;

describe('the tools and their stages', () => {
  it('are twelve unique ids, each with a stage, a list of feeds, outputs and expected diagram words', () => {
    expect(TOOL_IDS).toHaveLength(12);
    expect(new Set(TOOL_IDS).size).toBe(12);
    for (const id of TOOL_IDS) {
      expect(STAGES, id).toContain(STAGE_OF[id]);
      expect(FEEDS[id], id).toBeDefined();
      expect(OUTPUTS[id].length, id).toBeGreaterThan(0);
      expect(EXPECTED_ON_DIAGRAM[id].length, id).toBeGreaterThanOrEqual(3);
      expect(new Set(OUTPUTS[id]).size, id).toBe(OUTPUTS[id].length);
    }
  });
  it('split 2, 5, 3, 1, 1 across Define, Analyse, Decide, Act and Document', () => {
    expect(STAGES.map((s) => TOOL_IDS.filter((id) => STAGE_OF[id] === s).length)).toEqual([2, 5, 3, 1, 1]);
  });
});

describe('the thread', () => {
  it('only feeds real tools, never itself', () => {
    for (const id of TOOL_IDS) {
      for (const to of FEEDS[id]) { expect(TOOL_IDS, `${id} → ${to}`).toContain(to); expect(to).not.toBe(id); }
      expect(new Set(FEEDS[id]).size, id).toBe(FEEDS[id].length);
    }
  });
  it('has no loop: following the feeds never comes back', () => {
    const state = new Map<ToolId, 'open' | 'done'>();
    const visit = (id: ToolId): boolean => {
      if (state.get(id) === 'open') return false;
      if (state.get(id) === 'done') return true;
      state.set(id, 'open');
      const ok = FEEDS[id].every((to) => visit(to as ToolId));
      state.set(id, 'done');
      return ok;
    };
    for (const id of TOOL_IDS) expect(visit(id), id).toBe(true);
  });
  it('never feeds backwards: a tool is in the same stage as, or a later stage than, every tool that feeds it', () => {
    for (const id of TOOL_IDS) for (const to of FEEDS[id]) expect(STAGES.indexOf(STAGE_OF[to as ToolId]), `${id} → ${to}`).toBeGreaterThanOrEqual(STAGES.indexOf(STAGE_OF[id]));
  });
  it('starts at 5W2H and the Affinity wall, ends at the A3 report, and reaches every tool from the start', () => {
    const roots = TOOL_IDS.filter((id) => upstreamOf(id).length === 0);
    expect(roots.sort()).toEqual(['5w2h', 'affinity']);
    expect(TOOL_IDS.filter((id) => downstreamOf(id).length === 0)).toEqual(['a3']);
    const seen = new Set<string>(roots);
    for (let changed = true; changed;) { changed = false; for (const id of [...seen]) for (const to of downstreamOf(id as ToolId)) if (!seen.has(to)) { seen.add(to); changed = true; } }
    expect(seen.size).toBe(12);
  });
  it('is two-way: the A3 builds on seven tools, the 5W2H feeds seven', () => {
    expect(upstreamOf('a3').sort()).toEqual(['5w2h', 'copq', 'five-whys', 'fmea-lite', 'pareto', 'pdca', 'pugh']);
    expect(downstreamOf('5w2h')).toHaveLength(7);
    expect(upstreamOf('fishbone').sort()).toEqual(['5w2h', 'affinity', 'is-is-not', 'pareto']);
  });
});

describe('the one-click suggestions', () => {
  it('each come from a tool the field’s own tool builds on, and from an output that tool really declares', () => {
    expect(PREFILLS.length).toBeGreaterThanOrEqual(10);
    for (const p of PREFILLS) {
      expect(upstreamOf(p.tool), `${p.tool}.${p.field} ← ${p.from}`).toContain(p.from);
      expect(OUTPUTS[p.from], `${p.from}.${p.output}`).toContain(p.output);
    }
  });
  it('are unique per field, and give the A3 report a suggestion for six of its seven boxes', () => {
    const keys = PREFILLS.map((p) => `${p.tool}.${p.field}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(PREFILLS.filter((p) => p.tool === 'a3')).toHaveLength(6);
  });
});
