import { beforeEach, describe, expect, it, vi } from 'vitest';

const { catalogue, fillins } = vi.hoisted(() => ({
  catalogue: [
    { toolId: 'pestel', name: 'PESTEL / SWOT' },
    { toolId: 'ansoff', name: 'Ansoff Matrix' },
    { toolId: 'bmc', name: 'Business Model Canvas' },
  ] as { toolId: string; name: string }[],
  fillins: [] as unknown[],
}));

vi.mock('../lib/strategyFrameworks', () => ({ listStrategyFrameworks: vi.fn(async () => catalogue) }));
vi.mock('../lib/strategyFillins', () => ({ listFillins: vi.fn(async () => fillins) }));

import { loadConnections, summariseConnected, upstreamPromptBlock, usedUpstreamNames } from '../lib/strategyHubConnections';
import { fingerprintFields, EMPTY_RECORD, type FillinRecord } from '../lib/strategyFillinTypes';

const fields = [{ label: 'Strengths', value: 'In-house CNC', source: 'Manual' }, { label: 'Weaknesses', value: '', source: 'Manual' }];
const analysed: FillinRecord = {
  ...EMPTY_RECORD,
  fields,
  analysis: { summary: 'A strong technical base. Weak cash discipline.', verdict: { label: 'Strong core, fragile cash', rationale: 'x' }, findings: [], watchouts: [] },
  analysisFingerprint: fingerprintFields(fields),
  analysisAt: '2026-10-03T10:00:00.000Z',
  recommendations: [{ text: 'R1' }, { text: 'R2' }, { text: 'R3' }, { text: 'R4' }],
  updatedAt: '2026-10-03T10:00:00.000Z',
};

beforeEach(() => { fillins.length = 0; });

describe('summariseConnected', () => {
  it('is not_started with nothing saved', () => {
    const c = summariseConnected('pestel', 'PESTEL / SWOT', null);
    expect(c).toMatchObject({ toolId: 'pestel', name: 'PESTEL / SWOT', status: 'not_started', headline: null, summary: null, topRecommendations: [], filled: [] });
  });

  it('carries the verdict as the headline, the summary, three recommendations and only the answers that were filled in', () => {
    const c = summariseConnected('pestel', 'PESTEL / SWOT', analysed);
    expect(c.status).toBe('analysed');
    expect(c.headline).toBe('Strong core, fragile cash');
    expect(c.summary).toBe('A strong technical base. Weak cash discipline.');
    expect(c.topRecommendations).toEqual(['R1', 'R2', 'R3']);
    expect(c.filled).toEqual([{ label: 'Strengths', value: 'In-house CNC' }]);
  });

  it('is in_progress when answers exist but there is no analysis yet', () => {
    expect(summariseConnected('pestel', 'P', { ...EMPTY_RECORD, fields }).status).toBe('in_progress');
  });
});

describe('upstreamPromptBlock', () => {
  it('is empty when no earlier tool has any saved work, so a prompt is unchanged for a client who has not used them', () => {
    expect(upstreamPromptBlock([])).toBe('');
    expect(upstreamPromptBlock([summariseConnected('pestel', 'PESTEL / SWOT', null)])).toBe('');
  });

  it('hands the model each earlier tool\'s conclusion, summary, answers and recommendations, and says to stay consistent', () => {
    const block = upstreamPromptBlock([summariseConnected('pestel', 'PESTEL / SWOT', analysed)]);
    expect(block).toContain('SAVED WORK FROM THE TOOLS THIS ONE BUILDS ON');
    expect(block).toContain('stay consistent');
    expect(block).toContain('[PESTEL / SWOT] — analysed');
    expect(block).toContain('Conclusion: Strong core, fragile cash');
    expect(block).toContain('- Strengths: In-house CNC');
    expect(block).not.toContain('Weaknesses'); // blank answers are not passed on
    expect(block).toContain('1. R1');
    expect(block).not.toContain('R4'); // only the top three
  });

  it('says when an earlier tool\'s analysis predates later edits, or was never run', () => {
    const stale = summariseConnected('pestel', 'PESTEL / SWOT', { ...analysed, fields: [{ label: 'Strengths', value: 'Changed since', source: 'Manual' }] });
    expect(upstreamPromptBlock([stale])).toContain('analysed earlier; answers edited since');
    const inProgress = summariseConnected('ansoff', 'Ansoff Matrix', { ...EMPTY_RECORD, fields });
    expect(upstreamPromptBlock([inProgress])).toContain('filled in, not yet analysed');
  });

  it('keeps one runaway answer from crowding out the rest of the prompt', () => {
    const long = 'x'.repeat(5000);
    const c = summariseConnected('pestel', 'P', { ...EMPTY_RECORD, fields: [{ label: 'Strengths', value: long, source: 'Manual' }] });
    const block = upstreamPromptBlock([c]);
    expect(block.length).toBeLessThan(2000);
    expect(block).toContain('…');
  });
});

describe('usedUpstreamNames', () => {
  it('names only the earlier tools that actually had work to pass on', () => {
    const list = [summariseConnected('pestel', 'PESTEL / SWOT', analysed), summariseConnected('ansoff', 'Ansoff Matrix', null)];
    expect(usedUpstreamNames(list)).toEqual(['PESTEL / SWOT']);
  });
});

describe('loadConnections', () => {
  it('reads the client\'s own saved work for each tool the framework builds on and feeds', async () => {
    fillins.push({ toolId: 'pestel', ...analysed });
    const c = await loadConnections({ clientId: 'learner-7', section: 'problem-solving', caseId: 3 }, { upstream: ['pestel'], downstream: ['bmc', 'ansoff'] });
    expect(c.upstream.map((x) => [x.toolId, x.status])).toEqual([['pestel', 'analysed']]);
    expect(c.downstream.map((x) => [x.toolId, x.status])).toEqual([['bmc', 'not_started'], ['ansoff', 'not_started']]);
    expect(c.upstream[0].name).toBe('PESTEL / SWOT');
  });

  it('skips a tool id the catalogue no longer has, rather than failing', async () => {
    const c = await loadConnections({ clientId: 'learner-7', section: 'problem-solving', caseId: 3 }, { upstream: ['pestel', 'deleted-tool'], downstream: [] });
    expect(c.upstream.map((x) => x.toolId)).toEqual(['pestel']);
  });
});
