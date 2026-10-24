import { describe, expect, it } from 'vitest';
import {
  alignFields,
  analysisHeadline,
  countFilled,
  fillinStatus,
  fingerprintFields,
  normaliseActionables,
  normaliseAnalysis,
  normaliseRecommendations,
  EMPTY_RECORD,
} from '../lib/strategyFillinTypes';
import type { FrameworkField } from '../lib/strategyFrameworks';

const f = (label: string, value: string, source = 'Manual'): FrameworkField => ({ label, value, source });

describe('fingerprintFields — what makes a saved analysis "out of date"', () => {
  it('is the same however the fields are ordered', () => {
    expect(fingerprintFields([f('A', '1'), f('B', '2')])).toBe(fingerprintFields([f('B', '2'), f('A', '1')]));
  });

  it('ignores the source badge and surrounding spaces — only a change of content counts', () => {
    expect(fingerprintFields([f('A', 'value', 'Manual')])).toBe(fingerprintFields([f('A', '  value  ', 'AI')]));
  });

  it('changes when a value or a label changes', () => {
    const base = fingerprintFields([f('A', 'one')]);
    expect(fingerprintFields([f('A', 'two')])).not.toBe(base);
    expect(fingerprintFields([f('A2', 'one')])).not.toBe(base);
  });

  it('does not confuse a value moved between two fields', () => {
    expect(fingerprintFields([f('A', 'x'), f('B', '')])).not.toBe(fingerprintFields([f('A', ''), f('B', 'x')]));
  });
});

describe('fillinStatus', () => {
  const analysis = { summary: 'S', verdict: null, findings: [], watchouts: [] };

  it('is not_started with no record, no fields, or only blank fields', () => {
    expect(fillinStatus(null)).toBe('not_started');
    expect(fillinStatus(EMPTY_RECORD)).toBe('not_started');
    expect(fillinStatus({ ...EMPTY_RECORD, fields: [f('A', '   ')] })).toBe('not_started');
  });

  it('is in_progress once something is filled in but nothing has been analysed', () => {
    expect(fillinStatus({ ...EMPTY_RECORD, fields: [f('A', 'x')] })).toBe('in_progress');
  });

  it('is analysed while the analysis still matches the fields, and stale the moment they change', () => {
    const fields = [f('A', 'x'), f('B', 'y')];
    const analysed = { ...EMPTY_RECORD, fields, analysis, analysisFingerprint: fingerprintFields(fields) };
    expect(fillinStatus(analysed)).toBe('analysed');
    expect(fillinStatus({ ...analysed, fields: [f('A', 'x'), f('B', 'changed')] })).toBe('stale');
  });

  it('treats an analysis with no fingerprint as stale rather than current', () => {
    expect(fillinStatus({ ...EMPTY_RECORD, fields: [f('A', 'x')], analysis, analysisFingerprint: null })).toBe('stale');
  });
});

describe('alignFields — the saved list is always the framework\'s own fields, in its order', () => {
  const def = [{ label: 'A' }, { label: 'B' }, { label: 'C' }];

  it('keeps the framework order and blanks what was not posted', () => {
    expect(alignFields(def, [{ label: 'C', value: 'c' }, { label: 'A', value: 'a', source: 'AI' }])).toEqual([
      { label: 'A', value: 'a', source: 'AI' },
      { label: 'B', value: '', source: 'Manual' },
      { label: 'C', value: 'c', source: 'Manual' },
    ]);
  });

  it('drops labels the framework does not have', () => {
    expect(alignFields(def, [{ label: 'Z', value: 'z' }]).map((x) => x.label)).toEqual(['A', 'B', 'C']);
  });

  it('lets the last entry for a label win', () => {
    expect(alignFields(def, [{ label: 'A', value: 'old' }, { label: 'A', value: 'new' }])[0].value).toBe('new');
  });

  it('gives the same fingerprint whichever subset of fields a request carried, once the rest are blank', () => {
    const full = alignFields(def, [{ label: 'A', value: 'a' }, { label: 'B', value: '' }, { label: 'C', value: '' }]);
    const partial = alignFields(def, [{ label: 'A', value: 'a' }]);
    expect(fingerprintFields(full)).toBe(fingerprintFields(partial));
  });
});

describe('countFilled', () => {
  it('counts only non-blank values', () => {
    expect(countFilled([f('A', 'x'), f('B', ' '), f('C', '')])).toBe(1);
  });
});

describe('normaliseRecommendations / normaliseActionables', () => {
  it('keeps {text} objects and bare strings, drops empties and junk', () => {
    expect(normaliseRecommendations([{ text: ' do this ' }, 'or this', { text: '  ' }, 5, null, { nope: 1 }])).toEqual([{ text: 'do this' }, { text: 'or this' }]);
    expect(normaliseRecommendations('not an array')).toEqual([]);
  });

  it('fills a missing owner, timeframe and priority with the usual defaults', () => {
    expect(normaliseActionables([{ action: 'Call the buyer' }])).toEqual([
      { action: 'Call the buyer', owner: 'Founder / Owner', timeframe: 'Next 30 days', priority: 'Medium' },
    ]);
  });

  it('accepts only High / Medium / Low as a priority, and drops actions with no text', () => {
    const out = normaliseActionables([
      { action: 'A', owner: 'Finance Head', timeframe: 'This quarter', priority: 'High' },
      { action: 'B', priority: 'Urgent' },
      { owner: 'No action text' },
    ]);
    expect(out.map((a) => [a.action, a.priority])).toEqual([['A', 'High'], ['B', 'Medium']]);
  });
});

describe('normaliseAnalysis', () => {
  it('reads a complete analysis', () => {
    const a = normaliseAnalysis({
      summary: ' The market is attractive. ',
      verdict: { label: 'Attractive', rationale: 'Few rivals.' },
      findings: [{ title: 'Strongest force', detail: 'Buyers.' }, 'A bare finding'],
      watchouts: ['Check the data', '', 7],
    });
    expect(a).toEqual({
      summary: 'The market is attractive.',
      verdict: { label: 'Attractive', rationale: 'Few rivals.' },
      findings: [{ title: 'Strongest force', detail: 'Buyers.' }, { title: '', detail: 'A bare finding' }],
      watchouts: ['Check the data'],
    });
  });

  it('allows a missing verdict (some models have no single one)', () => {
    expect(normaliseAnalysis({ summary: 'S', verdict: null })?.verdict).toBeNull();
    expect(normaliseAnalysis({ summary: 'S', verdict: { rationale: 'no label' } })?.verdict).toBeNull();
  });

  it('is null when there is nothing usable', () => {
    expect(normaliseAnalysis(null)).toBeNull();
    expect(normaliseAnalysis([])).toBeNull();
    expect(normaliseAnalysis({ summary: '  ', findings: [] })).toBeNull();
  });
});

describe('analysisHeadline', () => {
  it('prefers the verdict, then the first sentence of the summary', () => {
    expect(analysisHeadline({ summary: 'First sentence. Second one.', verdict: { label: 'Needs focus', rationale: '' }, findings: [], watchouts: [] })).toBe('Needs focus');
    expect(analysisHeadline({ summary: 'First sentence. Second one.', verdict: null, findings: [], watchouts: [] })).toBe('First sentence.');
    expect(analysisHeadline(null)).toBeNull();
  });
});
