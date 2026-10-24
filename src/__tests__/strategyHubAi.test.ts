import { describe, expect, it } from 'vitest';
import {
  AI_SOURCE,
  buildAnalyzeMessages,
  buildGenerateMessages,
  cleanClientFields,
  fillableLabels,
  hasAnyOutput,
  mergeGenerated,
  parseAnalysis,
  parseGenerated,
} from '../lib/strategyHubAi';

const framework = {
  name: "Porter's Five Forces",
  layer: 'L1' as const,
  fields: [
    { label: 'Supplier power', value: 'example', source: 'Manual' },
    { label: 'Buyer power', value: 'example', source: 'Manual' },
    { label: 'Rivalry', value: 'example', source: 'Manual' },
  ],
};
const ctx = { contextBlock: '', valueScanBlock: '', upstreamBlock: '' };

describe('cleanClientFields', () => {
  it('keeps labelled entries, stringifies values, defaults the source and drops junk', () => {
    expect(cleanClientFields([{ label: 'A', value: 5 }, { label: '  ', value: 'x' }, null, 'str', { value: 'no label' }, { label: 'B', value: 'b', source: 'AI' }])).toEqual([
      { label: 'A', value: '5', source: 'Manual' },
      { label: 'B', value: 'b', source: 'AI' },
    ]);
    expect(cleanClientFields('nope')).toEqual([]);
  });
});

describe('fillableLabels — the AI only writes what the client has not answered', () => {
  it('offers fields with no answer, a blank one, or one the AI wrote earlier — never the client\'s own', () => {
    const current = [
      { label: 'Supplier power', value: 'We depend on 3 alloy mills', source: 'Manual' },
      { label: 'Buyer power', value: '   ', source: 'Manual' },
      { label: 'Rivalry', value: 'AI wrote this', source: AI_SOURCE },
    ];
    expect(fillableLabels(framework, current)).toEqual(['Buyer power', 'Rivalry']);
  });

  it('offers everything when nothing has been answered, and nothing when everything has', () => {
    expect(fillableLabels(framework, [])).toEqual(['Supplier power', 'Buyer power', 'Rivalry']);
    expect(fillableLabels(framework, framework.fields.map((x) => ({ label: x.label, value: 'mine', source: 'Template' })))).toEqual([]);
  });

  it('treats an imported or document-extracted answer as the client\'s own', () => {
    const current = [{ label: 'Supplier power', value: 'from a file', source: 'Document' }];
    expect(fillableLabels(framework, current)).not.toContain('Supplier power');
  });
});

describe('buildGenerateMessages', () => {
  const fillable = ['Buyer power', 'Rivalry'];
  const current = [{ label: 'Supplier power', value: 'We depend on 3 alloy mills', source: 'Manual' }];

  it('lists only the fillable fields to draft, and gives the client\'s own answers as fixed context', () => {
    const { system, user } = buildGenerateMessages({ framework, methodology: 'METHOD TEXT', fillable, current, ctx });
    expect(system).toContain('filling in the "Porter\'s Five Forces" strategy framework');
    expect(system).toContain('METHOD TEXT');
    expect(system).toContain('1. "Buyer power"');
    expect(system).toContain('2. "Rivalry"');
    expect(system).not.toContain('"Supplier power"');
    expect(user).toContain('ANSWERS ALREADY GIVEN BY THE CLIENT');
    expect(user).toContain('- Supplier power: We depend on 3 alloy mills');
  });

  it('puts the client\'s saved work from earlier tools in front of the model', () => {
    const { user } = buildGenerateMessages({ framework, methodology: 'M', fillable, current: [], ctx: { ...ctx, upstreamBlock: 'SAVED WORK FROM THE TOOLS THIS ONE BUILDS ON …' } });
    expect(user).toContain('SAVED WORK FROM THE TOOLS THIS ONE BUILDS ON');
    expect(user).not.toContain('No business context');
  });

  it('says plainly when there is no evidence at all, instead of inventing a client', () => {
    const { user } = buildGenerateMessages({ framework, methodology: 'M', fillable, current: [], ctx });
    expect(user).toContain('No business context or Value Scan report is on file');
  });

  it('does not repeat an answer the AI wrote earlier as if it were the client\'s', () => {
    const { user } = buildGenerateMessages({ framework, methodology: 'M', fillable: ['Rivalry'], current: [{ label: 'Buyer power', value: 'old AI draft', source: AI_SOURCE }], ctx });
    expect(user).not.toContain('old AI draft');
  });
});

describe('parseGenerated', () => {
  const fillable = ['Buyer power', 'Rivalry'];

  it('returns the drafted values for the fields it was asked about', () => {
    const out = parseGenerated(JSON.stringify({ fields: [{ label: 'Buyer power', value: ' High ' }, { label: 'Rivalry', value: 'Medium' }] }), fillable);
    expect([...out]).toEqual([['Buyer power', 'High'], ['Rivalry', 'Medium']]);
  });

  it('matches labels leniently (case and spacing) but ignores labels it was not asked about and empty values', () => {
    const out = parseGenerated(JSON.stringify({ fields: [{ label: 'buyer  POWER', value: 'x' }, { label: 'Supplier power', value: 'sneaky' }, { label: 'Rivalry', value: '  ' }] }), fillable);
    expect([...out]).toEqual([['Buyer power', 'x']]);
  });

  it('turns numbers into text and tolerates a missing fields array', () => {
    expect([...parseGenerated(JSON.stringify({ fields: [{ label: 'Rivalry', value: 4 }] }), fillable)]).toEqual([['Rivalry', '4']]);
    expect(parseGenerated('{}', fillable).size).toBe(0);
  });

  it('throws on output that is not JSON, so the route can answer "try again"', () => {
    expect(() => parseGenerated('not json', fillable)).toThrow();
  });
});

describe('mergeGenerated — the saved list after an AI fill', () => {
  it('writes the AI draft only where the AI was allowed to, and keeps every other answer exactly as it was', () => {
    const current = [
      { label: 'Supplier power', value: 'mine', source: 'Manual' },
      { label: 'Rivalry', value: 'old AI', source: AI_SOURCE },
    ];
    const fillable = ['Buyer power', 'Rivalry'];
    const generated = new Map([['Buyer power', 'drafted'], ['Rivalry', 'redrafted'], ['Supplier power', 'must not apply']]);
    expect(mergeGenerated(framework, current, fillable, generated)).toEqual([
      { label: 'Supplier power', value: 'mine', source: 'Manual' },
      { label: 'Buyer power', value: 'drafted', source: AI_SOURCE },
      { label: 'Rivalry', value: 'redrafted', source: AI_SOURCE },
    ]);
  });

  it('keeps an existing answer where the AI returned nothing for a fillable field, and always returns the whole list', () => {
    const out = mergeGenerated(framework, [{ label: 'Rivalry', value: 'old AI', source: AI_SOURCE }], ['Buyer power', 'Rivalry'], new Map([['Buyer power', 'drafted']]));
    expect(out.map((x) => x.label)).toEqual(['Supplier power', 'Buyer power', 'Rivalry']);
    expect(out[2]).toEqual({ label: 'Rivalry', value: 'old AI', source: AI_SOURCE });
    expect(out[0]).toEqual({ label: 'Supplier power', value: '', source: 'Manual' });
  });
});

describe('buildAnalyzeMessages', () => {
  const fields = [{ label: 'Supplier power', value: 'High — 3 mills', source: 'Manual' }, { label: 'Buyer power', value: '', source: 'Manual' }];

  it('asks for analysis, recommendations and actionables, with the methodology and no length limit', () => {
    const { system } = buildAnalyzeMessages({ framework, methodology: 'METHOD TEXT', fields, ctx });
    expect(system).toContain('producing the final Analysis, Recommendations & Actionables');
    expect(system).toContain('METHOD TEXT');
    expect(system).toContain('NO length limit');
    expect(system).toContain('"analysis"');
    expect(system).toContain('"recommendations"');
    expect(system).toContain('"actionables"');
  });

  it('sends every field — a blank one is marked as left blank — and the upstream work ahead of the business context', () => {
    const { user } = buildAnalyzeMessages({ framework, methodology: 'M', fields, ctx: { contextBlock: 'CONTEXT', valueScanBlock: 'VALUESCAN', upstreamBlock: 'UPSTREAM' } });
    expect(user).toContain('- Supplier power: High — 3 mills');
    expect(user).toContain('- Buyer power: (left blank)');
    expect(user.indexOf('UPSTREAM')).toBeLessThan(user.indexOf('CONTEXT'));
    expect(user).toContain('VALUESCAN');
  });

  it('tells the model to stay consistent with earlier tools\' conclusions', () => {
    expect(buildAnalyzeMessages({ framework, methodology: 'M', fields, ctx }).system).toContain('stay consistent');
  });
});

describe('parseAnalysis', () => {
  const full = {
    analysis: { summary: 'S', verdict: { label: 'V', rationale: 'R' }, findings: [{ title: 'T', detail: 'D' }], watchouts: ['W'] },
    recommendations: [{ text: 'Do it' }],
    actionables: [{ action: 'Act', owner: 'CEO', timeframe: 'Now', priority: 'High' }],
  };

  it('reads all three parts', () => {
    const p = parseAnalysis(JSON.stringify(full));
    expect(p.analysis?.summary).toBe('S');
    expect(p.recommendations).toEqual([{ text: 'Do it' }]);
    expect(p.actionables[0].priority).toBe('High');
    expect(hasAnyOutput(p)).toBe(true);
  });

  it('still reads an older-style reply that has recommendations and actionables but no analysis', () => {
    const p = parseAnalysis(JSON.stringify({ recommendations: full.recommendations, actionables: full.actionables }));
    expect(p.analysis).toBeNull();
    expect(hasAnyOutput(p)).toBe(true);
  });

  it('reports nothing usable for an empty object, and throws on text that is not JSON', () => {
    expect(hasAnyOutput(parseAnalysis('{}'))).toBe(false);
    expect(() => parseAnalysis('oops')).toThrow();
  });
});
