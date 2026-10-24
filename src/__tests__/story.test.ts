/**
 * story.test.ts — the story bible of the Problem Solving worked example. Every derived figure the twelve samples quote is computed here from the
 * raw data, so a sample can never say 81.4% where the data says 79%. Also checks that the story agrees with the Strategy Hub's own fictional company.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { COMPANY, COPQ, FIXES, FMEA, LINE2, PARETO, PUGH, REVENUE_LAKH, TRIAL, WHYS } from '../lib/problemSolving/story';
import { boardTable, quadrantOf } from '../lib/strategyModels/boards';

const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);
const r1 = (n: number) => Math.round(n * 10) / 10;
const r2 = (n: number) => Math.round(n * 100) / 100;

describe('the problem statement (5W2H)', () => {
  it('is 1,008 reworked of 18,700 welded: 5.4% against a 2% target, a gap of 3.4 points', () => {
    const rate = (LINE2.quarter.reworked / LINE2.quarter.welded) * 100;
    expect(r1(rate)).toBe(5.4);
    expect(r1(rate - LINE2.targetRate)).toBe(3.4);
  });
});

describe('cost of poor quality', () => {
  it('adds to ₹228 lakh, which is 2.33% of revenue, and fixing the rework gap saves ₹133 lakh', () => {
    expect(sum(COPQ.map((c) => c.lakh))).toBe(228);
    expect(r2((228 / REVENUE_LAKH) * 100)).toBe(2.33);
    expect(r1(LINE2.outputAtCostLakh * ((LINE2.reworkRate12m - LINE2.targetRate) / 100))).toBe(133);
  });
});

describe('Pareto', () => {
  it('counts 1,008 defects; the top three are 81.4% of them and porosity alone is 40.9%', () => {
    const total = sum(PARETO.map((p) => p.count));
    expect(total).toBe(LINE2.quarter.reworked); // the Pareto explains exactly the reworked parts
    expect(r1((sum(PARETO.slice(0, 3).map((p) => p.count)) / total) * 100)).toBe(81.4);
    expect(r1((PARETO[0].count / total) * 100)).toBe(40.9);
    expect([...PARETO].sort((a, b) => b.count - a.count).map((p) => p.defect)).toEqual(PARETO.map((p) => p.defect)); // already in descending order
  });
});

describe('5 Whys', () => {
  it('has five answers, the last of them a system gap and the only assumption outstanding', () => {
    expect(WHYS).toHaveLength(5);
    expect(WHYS.filter((w) => w.assumed)).toHaveLength(1);
    expect(WHYS[4].because).toBe('There is no utilities check when a station is added.');
    expect(LINE2.rootCause).toMatch(/No utilities check/);
    expect(WHYS[0].because).toMatch(/41%/); // the 40.9% of the Pareto, rounded
  });
});

describe('Pugh matrix', () => {
  const score = (o: 'A' | 'B' | 'C') => sum(PUGH.criteria.map((c) => c.weight * c[o]));
  it('scores A at +7, B at +8 and C at +4, so the top score is B and the choice (A and B together) departs from it knowingly', () => {
    expect([score('A'), score('B'), score('C')]).toEqual([7, 8, 4]);
    expect(PUGH.chosen).toBe('A and B together');
    expect(PUGH.criteria.every((c) => c.weight >= 1 && c.weight <= 5)).toBe(true);
  });
});

describe('FMEA', () => {
  const rpn = FMEA.map((f) => f.s * f.o * f.d);
  it('has risk priority numbers 96, 72, 216, 105, 126 and 40: the highest is the shared regulator and three are 100 or more', () => {
    expect(rpn).toEqual([96, 72, 216, 105, 126, 40]);
    expect(FMEA[rpn.indexOf(Math.max(...rpn))].mode).toMatch(/shared regulator/);
    expect(rpn.filter((n) => n >= 100)).toHaveLength(3);
  });
});

describe('Impact-effort', () => {
  const grid = boardTable('fixes', 'Fixes', 'Place each fix by how much it helps and how hard it is.',
    { layout: 'grid', noteLabel: 'fix', noteColumn: 'fix', xColumn: 'effort', yColumn: 'impact', axes: { x: { label: 'Effort', low: 'easy', high: 'hard' }, y: { label: 'Impact', low: 'small', high: 'large' } },
      quadrants: [{ name: 'Quick win', xHigh: false, yHigh: true }, { name: 'Major project', xHigh: true, yHigh: true }, { name: 'Fill-in', xHigh: false, yHigh: false }, { name: 'Avoid', xHigh: true, yHigh: false }], maxNoteChars: 120 },
    { scale: { min: 1, max: 10 } });
  it('puts three fixes in Quick win, one in Major project, four in Fill-in and none in Avoid', () => {
    const counts: Record<string, number> = { 'Quick win': 0, 'Major project': 0, 'Fill-in': 0, Avoid: 0 };
    for (const f of FIXES) counts[quadrantOf(grid, { fix: f.fix, effort: String(f.effort), impact: String(f.impact) })!]++;
    expect(counts).toEqual({ 'Quick win': 3, 'Major project': 1, 'Fill-in': 4, Avoid: 0 });
  });
  it('lists as quick wins the fixes the Pugh matrix and the FMEA rely on', () => {
    expect(FIXES.slice(0, 2).map((f) => f.fix)).toEqual(['Regulator and 12 mm line for each torch', 'Flow-meter alarm on both stations']);
    expect(PUGH.options.A).toMatch(/regulator/);
    expect(PUGH.options.B).toMatch(/flow-meter/);
  });
});

describe('PDCA trial', () => {
  const total = { welded: sum(TRIAL.map((t) => t.welded)), reworked: sum(TRIAL.map((t) => t.reworked)) };
  const weekly = TRIAL.map((t) => r2((t.reworked / t.welded) * 100));
  it('gives weekly rates 3.27, 2.57, 1.82 and 1.52%, and 99 of 4,300 overall, which is 2.30%', () => {
    expect(weekly).toEqual([3.27, 2.57, 1.82, 1.52]);
    expect(total).toEqual({ welded: 4300, reworked: 99 });
    expect(r2((total.reworked / total.welded) * 100)).toBe(2.3);
  });
  it('is 57.4% better than the 5.4% before; the last week beats the 2% target and the four-week average does not', () => {
    expect(r1((1 - 2.3 / 5.4) * 100)).toBe(57.4);
    expect(weekly[3]).toBeLessThan(LINE2.targetRate);
    expect(r2((total.reworked / total.welded) * 100)).toBeGreaterThan(LINE2.targetRate);
    expect(weekly).toEqual([...weekly].sort((a, b) => b - a)); // improving every week
  });
});

// FUTURESKILZ: the kit checked agreement with the Strategy Hub's own samples, which this app does not have. Here the check is
// that the section's worked examples tell the story-bible problem about the same fictional company.
describe('agreement with the section samples', () => {
  it('is the same fictional company and the same Line 2 problem', () => {
    const types = readFileSync(join(__dirname, '..', 'lib', 'strategyModels', 'types.ts'), 'utf8');
    expect(types).toContain(COMPANY);
    const all = ['define', 'analyse'].map((g) => readFileSync(join(__dirname, '..', 'lib', 'strategyModels', 'samples', `${g}.ts`), 'utf8')).join('\n');
    expect(all).toContain('Anand Auto Components');
    expect(all).toContain('Line 2');
  });
});
