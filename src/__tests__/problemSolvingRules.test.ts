import { describe, expect, it } from 'vitest';

import { gapToTarget, problemRate, problemStatement } from '../lib/strategyModels/defs/define';
import { assumptionCount } from '../lib/strategyModels/defs/analyse';
import { getModelDefinition, getModelSample } from '../lib/strategyModels/registry';
import { computeDerived, computeOutputs } from '../lib/strategyModels/values';
import type { ModelValues } from '../lib/strategyModels/types';

const values = (fields: Record<string, string>, tables: ModelValues['tables'] = {}): ModelValues => ({ fields, tables });
const derived = (toolId: string, v: ModelValues) => Object.fromEntries(computeDerived(getModelDefinition(toolId)!, v).map((d) => [d.key, d.value]));
const outputs = (toolId: string, v: ModelValues) => Object.fromEntries(computeOutputs(getModelDefinition(toolId)!, v).map((o) => [o.key, o.value]));

describe('5W2H arithmetic', () => {
  it('works out the problem rate and the gap to the target', () => {
    // 1,008 ÷ 18,700 = 0.05390 → 5.39% → shown as 5.4%; 5.4 − 2 = 3.4 points above the target.
    const v = values({ total: '18700', affected: '1008', target: '2' });
    expect(problemRate(v)).toBeCloseTo(5.3904, 4);
    expect(gapToTarget(v)).toBeCloseTo(3.4, 6);
    expect(derived('5w2h', v)).toEqual({ rate_now: '5.4%', gap: '3.4 points above the target' });
  });

  it('says when the rate is better than or on the target', () => {
    // 30 ÷ 2,000 = 1.5%; 1.5 − 2 = −0.5 → 0.5 points better.
    expect(derived('5w2h', values({ total: '2000', affected: '30', target: '2' })).gap).toBe('0.5 points better than the target');
    // 40 ÷ 2,000 = 2.0% exactly.
    expect(derived('5w2h', values({ total: '2000', affected: '40', target: '2' })).gap).toBe('On the target');
  });

  it('reads numbers the way people type them', () => {
    // "18,700" and "1,008" are 18700 and 1008.
    expect(derived('5w2h', values({ total: '18,700', affected: '1,008', target: '2' })).rate_now).toBe('5.4%');
  });

  it('shows nothing rather than a misleading figure when the input is incomplete or impossible', () => {
    expect(problemRate(values({ total: '', affected: '10' }))).toBeNull();
    expect(problemRate(values({ total: '0', affected: '0' }))).toBeNull();
    expect(problemRate(values({ total: '100', affected: '120' }))).toBeNull(); // more problems than items
    expect(gapToTarget(values({ total: '100', affected: '5' }))).toBeNull(); // no target yet
    expect(derived('5w2h', values({}))).toEqual({ rate_now: null, gap: null });
  });

  it('hands the next tools the one-sentence problem, or else What and How much joined', () => {
    expect(problemStatement(values({ problem: '  Late deliveries doubled  ' }))).toBe('Late deliveries doubled');
    const fromTable = values({}, { questions: [{ question: 'What', answer: 'Late deliveries' }, { question: 'How much', answer: '18 of 240 orders' }] });
    expect(problemStatement(fromTable)).toBe('Late deliveries — 18 of 240 orders');
    expect(problemStatement(values({}))).toBeNull();
  });

  it('gives the worked example the figures the story bible states', () => {
    const s = getModelSample('5w2h')!;
    expect(outputs('5w2h', { fields: s.values, tables: s.tables })).toMatchObject({ rate_now: '5.4%', target_rate: '2%' });
  });
});

describe('5 Whys arithmetic', () => {
  const chain = (statuses: string[]) => values({}, { chain: statuses.map((status, i) => ({ why: `Why ${i + 1}`, answer: `Answer ${i + 1}`, status })) });

  it('counts the answered links still marked Assumed', () => {
    // Four evidenced, one assumed → "1 of 5 answers is still an assumption".
    expect(assumptionCount(chain(['Evidenced', 'Evidenced', 'Evidenced', 'Evidenced', 'Assumed']))).toEqual({ assumed: 1, answered: 5 });
    expect(derived('five-whys', chain(['Evidenced', 'Evidenced', 'Evidenced', 'Evidenced', 'Assumed'])).assumed).toBe('1 of 5 answers is still an assumption');
  });

  it('warns when more than one link is assumed, and is good with one or none', () => {
    const tone = (statuses: string[]) => getModelDefinition('five-whys')!.derived[0].tone!(chain(statuses));
    expect(tone(['Assumed', 'Assumed', 'Evidenced'])).toBe('warn');
    expect(tone(['Assumed', 'Evidenced'])).toBe('good');
    expect(derived('five-whys', chain(['Assumed', 'Assumed', 'Evidenced'])).assumed).toBe('2 of 3 answers are still assumptions');
  });

  it('ignores whys with no answer, and shows nothing until one is answered', () => {
    const partly = values({}, { chain: [{ why: 'Why 1', answer: 'Because', status: 'Assumed' }, { why: 'Why 2', answer: '', status: 'Assumed' }] });
    expect(assumptionCount(partly)).toEqual({ assumed: 1, answered: 1 });
    expect(derived('five-whys', partly).assumed).toBe('1 of 1 answer is still an assumption');
    expect(assumptionCount(values({}))).toBeNull();
  });

  it('gives the worked example the story bible chain: one of five assumed, ending on a system gap', () => {
    const s = getModelSample('five-whys')!;
    const out = outputs('five-whys', { fields: s.values, tables: s.tables });
    expect(out.assumed_count).toBe('1 of 5');
    expect(out.root_cause).toMatch(/^No utilities check exists when a welding station is added/);
  });
});
