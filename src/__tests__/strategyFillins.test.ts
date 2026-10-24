import { beforeEach, describe, expect, it, vi } from 'vitest';

// FUTURESKILZ ADAPTATION of the Strategy Hub's test: an in-memory stand-in for the ws_fillins table, answering exactly the
// statements strategyFillins.ts issues, now keyed by (learner, section, case, tool) and with a version that rises on every
// write. The real SQL is exercised against MariaDB in the browser journey; these tests are about the logic around it.
const { rows, mockQuery } = vi.hoisted(() => {
  type Row = Record<string, unknown>;
  const rows: Row[] = [];
  const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
  const sameScope = (r: Row, p: unknown[]) => r.client_id === p[0] && r.section === p[1] && r.case_id === p[2];
  const mockQuery = vi.fn(async (sql: string, params: unknown[] = []) => {
    const q = norm(sql);
    if (/^SELECT tool_id, fields,/.test(q)) return [rows.filter((r) => sameScope(r, params)), undefined];
    if (/^SELECT fields, recommendations/.test(q)) return [rows.filter((r) => sameScope(r, params) && r.tool_id === params[3]).slice(0, 1), undefined];
    if (/^INSERT INTO ws_fillins/.test(q)) {
      const [client_id, section, case_id, tool_id, fields, recommendations, actionables, analysis, analysis_fingerprint, analysis_at, previous_fields, previous_reason] = params;
      const i = rows.findIndex((r) => sameScope(r, [client_id, section, case_id]) && r.tool_id === tool_id);
      const version = i >= 0 ? Number(rows[i].version) + 1 : 1;
      const row = { client_id, section, case_id, tool_id, fields, recommendations, actionables, analysis, analysis_fingerprint, analysis_at, previous_fields, previous_reason, version, updated_at: new Date() };
      if (i >= 0) rows[i] = row; else rows.push(row);
      return [{}, undefined];
    }
    if (/^UPDATE ws_fillins SET fields = \?, previous_fields = NULL, previous_reason = NULL, version = version \+ 1/.test(q)) {
      const r = rows.find((x) => sameScope(x, params.slice(1)) && x.tool_id === params[4]);
      if (r) Object.assign(r, { fields: params[0], previous_fields: null, previous_reason: null, version: Number(r.version) + 1, updated_at: new Date() });
      return [{}, undefined];
    }
    throw new Error('unexpected SQL: ' + q);
  });
  return { rows, mockQuery };
});

vi.mock('../lib/mysql', () => ({ default: { query: mockQuery } }));
vi.mock('../server/db/ensure-schema', () => ({ ensureDatabaseSchema: vi.fn(async () => undefined) }));

import { getFillin, listFillins, saveFillin, undoFieldChange } from '../lib/strategyFillins';
import { fillinStatus, fingerprintFields } from '../lib/strategyFillinTypes';

const S1 = { clientId: 'learner-1', section: 'problem-solving', caseId: 11 };
const S2 = { clientId: 'learner-2', section: 'problem-solving', caseId: 21 };

const f = (label: string, value: string, source = 'Manual') => ({ label, value, source });
const analysis = { summary: 'The market is attractive.', verdict: { label: 'Attractive', rationale: 'Few rivals' }, findings: [], watchouts: [] };

beforeEach(() => {
  rows.length = 0;
  mockQuery.mockClear();
});

describe('saved workspace work', () => {
  it('has nothing for a client who has saved nothing', async () => {
    expect(await getFillin(S1, 'porter5')).toBeNull();
  });

  it('saves and reads back fields, analysis, recommendations and actionables together', async () => {
    const fields = [f('A', 'one'), f('B', 'two')];
    await saveFillin(S1, 'porter5', {
      fields,
      analysis,
      recommendations: [{ text: 'Do this' }],
      actionables: [{ action: 'Act', owner: 'CEO', timeframe: 'Now', priority: 'High' }],
    });
    const rec = await getFillin(S1, 'porter5');
    expect(rec?.fields).toEqual(fields);
    expect(rec?.analysis).toEqual(analysis);
    expect(rec?.recommendations).toEqual([{ text: 'Do this' }]);
    expect(rec?.actionables).toHaveLength(1);
    expect(rec?.analysisAt).toBeTruthy();
    expect(fillinStatus(rec)).toBe('analysed');
  });

  it('keeps each client\'s work apart', async () => {
    await saveFillin(S1, 'porter5', { fields: [f('A', 'mine')] });
    await saveFillin(S2, 'porter5', { fields: [f('A', 'theirs')] });
    expect((await getFillin(S1, 'porter5'))?.fields[0].value).toBe('mine');
    expect((await getFillin(S2, 'porter5'))?.fields[0].value).toBe('theirs');
    expect(await listFillins(S1)).toHaveLength(1);
  });

  it('saving only the fields keeps the analysis, the recommendations and the actionables', async () => {
    await saveFillin(S1, 'porter5', { fields: [f('A', 'one')], analysis, recommendations: [{ text: 'R' }], actionables: [{ action: 'X', owner: 'O', timeframe: 'T', priority: 'Low' }] });
    await saveFillin(S1, 'porter5', { fields: [f('A', 'one edited')] });
    const rec = await getFillin(S1, 'porter5');
    expect(rec?.analysis).toEqual(analysis);
    expect(rec?.recommendations).toHaveLength(1);
    expect(rec?.actionables).toHaveLength(1);
  });

  it('saving only recommendations keeps the fields (and a recommendation-only save cannot create a fields-less row that hides them)', async () => {
    await saveFillin(S1, 'porter5', { fields: [f('A', 'kept')] });
    await saveFillin(S1, 'porter5', { recommendations: [{ text: 'R' }] });
    expect((await getFillin(S1, 'porter5'))?.fields).toEqual([f('A', 'kept')]);
  });

  it('shows the analysis as out of date once the fields change, and current again when they are put back', async () => {
    await saveFillin(S1, 'porter5', { fields: [f('A', 'one')], analysis });
    expect(fillinStatus(await getFillin(S1, 'porter5'))).toBe('analysed');
    await saveFillin(S1, 'porter5', { fields: [f('A', 'two')] });
    expect(fillinStatus(await getFillin(S1, 'porter5'))).toBe('stale');
    await saveFillin(S1, 'porter5', { fields: [f('A', 'one')] });
    expect(fillinStatus(await getFillin(S1, 'porter5'))).toBe('analysed');
  });

  it('stamps the analysis with the fingerprint of the fields it was written from', async () => {
    const fields = [f('A', 'one'), f('B', 'two')];
    await saveFillin(S1, 'porter5', { fields, analysis });
    expect((await getFillin(S1, 'porter5'))?.analysisFingerprint).toBe(fingerprintFields(fields));
  });

  it('a source-only change (Manual → AI badge) does not make an analysis stale', async () => {
    await saveFillin(S1, 'porter5', { fields: [f('A', 'one', 'Manual')], analysis });
    await saveFillin(S1, 'porter5', { fields: [f('A', 'one', 'AI')] });
    expect(fillinStatus(await getFillin(S1, 'porter5'))).toBe('analysed');
  });

  it('listFillins returns every tool the client has saved, with its tool id', async () => {
    await saveFillin(S1, 'porter5', { fields: [f('A', 'x')] });
    await saveFillin(S1, 'bmc', { fields: [f('B', 'y')], analysis });
    const all = await listFillins(S1);
    expect(all.map((r) => r.toolId).sort()).toEqual(['bmc', 'porter5']);
    expect(all.find((r) => r.toolId === 'bmc')?.analysis).toEqual(analysis);
  });
});

describe('one-step undo of an AI fill or import', () => {
  it('keeps the fields as they were before an AI fill, and puts them back on undo', async () => {
    await saveFillin(S1, 'porter5', { fields: [f('A', 'mine'), f('B', '')] });
    await saveFillin(S1, 'porter5', { fields: [f('A', 'mine'), f('B', 'AI draft', 'AI')] }, { snapshotReason: 'ai' });
    const after = await getFillin(S1, 'porter5');
    expect(after?.fields[1].value).toBe('AI draft');
    expect(after?.previousReason).toBe('ai');
    expect(after?.previousFields?.[1].value).toBe('');

    const undone = await undoFieldChange(S1, 'porter5');
    expect(undone?.fields).toEqual([f('A', 'mine'), f('B', '')]);
    expect(undone?.previousFields).toBeNull();
  });

  it('a hand edit after the fill means it was accepted: the undo is gone', async () => {
    await saveFillin(S1, 'porter5', { fields: [f('A', 'mine')] });
    await saveFillin(S1, 'porter5', { fields: [f('A', 'mine'), f('B', 'AI draft', 'AI')] }, { snapshotReason: 'ai' });
    await saveFillin(S1, 'porter5', { fields: [f('A', 'mine'), f('B', 'AI draft, tweaked')] });
    expect((await getFillin(S1, 'porter5'))?.previousFields).toBeNull();
    expect(await undoFieldChange(S1, 'porter5')).toBeNull();
  });

  it('remembers why: a template import is undone as a template import', async () => {
    await saveFillin(S1, 'porter5', { fields: [f('A', 'typed by hand')] });
    await saveFillin(S1, 'porter5', { fields: [f('A', 'from the file', 'Template')] }, { snapshotReason: 'template' });
    expect((await getFillin(S1, 'porter5'))?.previousReason).toBe('template');
  });

  it('keeps no undo for the very first fill (there was nothing before it to go back to)', async () => {
    await saveFillin(S1, 'porter5', { fields: [f('A', 'AI draft', 'AI')] }, { snapshotReason: 'ai' });
    expect((await getFillin(S1, 'porter5'))?.previousFields).toBeNull();
  });

  it('does not touch the analysis, so undoing a fill that was never re-analysed brings the analysis back to current', async () => {
    const original = [f('A', 'one')];
    await saveFillin(S1, 'porter5', { fields: original, analysis });
    await saveFillin(S1, 'porter5', { fields: [f('A', 'one'), f('B', 'AI draft', 'AI')] }, { snapshotReason: 'ai' });
    expect(fillinStatus(await getFillin(S1, 'porter5'))).toBe('stale');
    await undoFieldChange(S1, 'porter5');
    expect(fillinStatus(await getFillin(S1, 'porter5'))).toBe('analysed');
  });

  it('there is nothing to undo when nothing was filled in bulk', async () => {
    await saveFillin(S1, 'porter5', { fields: [f('A', 'x')] });
    expect(await undoFieldChange(S1, 'porter5')).toBeNull();
    expect(await undoFieldChange(S1, 'never-saved')).toBeNull();
  });
});

describe('case scope and versions (FutureSkilz workspace)', () => {
  it("keeps two problems of the same learner apart: one problem never shows another problem's work", async () => {
    const problemA = { ...S1, caseId: 11 };
    const problemB = { ...S1, caseId: 12 };
    await saveFillin(problemA, '5w2h', { fields: [f('What', 'Weld rework on Line 2')] });
    expect(await getFillin(problemB, '5w2h')).toBeNull();
    expect(await listFillins(problemB)).toEqual([]);
    expect((await listFillins(problemA)).map((r) => r.toolId)).toEqual(['5w2h']);
  });

  it('keeps two sections apart for the same learner and case number', async () => {
    await saveFillin(S1, '5w2h', { fields: [f('What', 'x')] });
    expect(await getFillin({ ...S1, section: 'another-section' }, '5w2h')).toBeNull();
  });

  it('raises the version on every write, including an undo', async () => {
    await saveFillin(S1, '5w2h', { fields: [f('What', 'one')] });
    expect((await getFillin(S1, '5w2h'))?.version).toBe(1);
    await saveFillin(S1, '5w2h', { fields: [f('What', 'one'), f('Why', 'AI draft', 'AI')] }, { snapshotReason: 'ai' });
    expect((await getFillin(S1, '5w2h'))?.version).toBe(2);
    await undoFieldChange(S1, '5w2h');
    expect((await getFillin(S1, '5w2h'))?.version).toBe(3);
  });
});
