/**
 * samples/define.ts — the worked example for 5W2H, told about the fictional Anand Auto Components (Pune) and its Line 2
 * weld rework. Every figure comes from problemSolving/story.ts, so the twelve worked examples tell one consistent story.
 */
import { LINE2 } from '../../problemSolving/story';
import type { ModelSample } from '../types';

const { welded, reworked } = LINE2.quarter;

export const DEFINE_SAMPLES: Record<string, ModelSample> = {
  '5w2h': {
    scenario: `Anand Auto Components (Pune) — weld rework on Line 2 has more than doubled, and the plant head wants it described properly before anyone changes anything.`,
    values: {
      problem: `Weld rework on the ${LINE2.part} at Line 2 is running at 5.4% of parts welded, against a ${LINE2.targetRate}% target.`,
      total: String(welded),
      affected: String(reworked),
      target: String(LINE2.targetRate),
    },
    tables: {
      questions: [
        { question: 'What', answer: `Porosity (gas holes) in the weld seam of the ${LINE2.part}, found after welding and sent back for rework.`, evidence: 'Defect log for the last quarter: porosity is the largest single defect type.' },
        { question: 'Why', answer: 'Rework on Line 2 costs about ₹96 lakh a year and has delayed two shipments to the anchor customer.', evidence: 'Cost of poor quality review; dispatch delay register.' },
        { question: 'Where', answer: `At stations ${LINE2.stations.join(' and ')} on Line 2. Not at W1 or W2, and not on Line 1.`, evidence: 'Defect log split by station.' },
        { question: 'When', answer: `Since week ${LINE2.sharedRegulatorSinceWeek}, on both shifts, mostly when both stations are welding at the same time. Rare before week ${LINE2.sharedRegulatorSinceWeek}.`, evidence: 'Weekly defect trend chart.' },
        { question: 'Who', answer: 'Found by the end-of-line inspectors; the anchor customer’s incoming-quality team has queried two batches. The second-shift welders at W3 and W4 see it most.', evidence: 'Inspection records; two customer queries on file.' },
        { question: 'How', answer: 'Pin-holes on the seam, seen at visual inspection and confirmed with a dye-penetrant test; reworked parts are ground out and re-welded.', evidence: 'Inspection procedure and rework tags.' },
        { question: 'How much', answer: `${reworked.toLocaleString('en-IN')} of ${welded.toLocaleString('en-IN')} brackets last quarter (5.4%), against a ${LINE2.targetRate}% target.`, evidence: 'Quarterly production and rework counts.' },
      ],
    },
    why: {
      problem: 'One sentence with a number, a place and a target is something the whole plant can agree on.',
      affected: 'Counting reworked parts against parts welded gives a rate that can be tracked week by week.',
      questions: 'Where and When each say where and when the problem does NOT happen; that contrast points the next tools at W3 and W4 and at week 27.',
    },
    analysis: {
      summary:
        'The problem is now stated with a number, a place and a time: 5.4% of brackets reworked last quarter against a 2% target, concentrated at stations W3 and W4 since week 27. Every answer is an observation with a source, and none of them guesses at the cause, so the problem is ready for analysis. The clearest lead is the contrast between W3 and W4 and the rest of the line, and the start in week 27.',
      verdict: {
        label: 'Well stated and ready to analyse',
        rationale: 'It has a measured rate, a gap of 3.4 points to the target, a location, a start date and evidence for each answer.',
      },
      findings: [
        { title: 'A sharp place and time', detail: 'The problem is at W3 and W4 and not at W1, W2 or Line 1, and it began in week 27: whatever changed there and then is the first thing to investigate.' },
        { title: 'A gap big enough to matter', detail: 'At 5.4% against 2%, the line is 3.4 points above target, which is about 640 extra reworked brackets a quarter.' },
        { title: 'The answers describe, they do not diagnose', detail: 'No answer names a cause or a fix, so the analysis that follows will not be steered by an early guess.' },
        { title: 'The customer has noticed', detail: 'Two batch queries from the anchor customer make this a delivery and relationship risk, not only a cost.' },
      ],
      watchouts: [
        'The “When” answer says “mostly when both stations are welding”: that is a pattern to test, not yet a fact.',
        'The rework count relies on inspectors tagging every part; check the tagging was the same before and after week 27.',
        'The ₹96 lakh cost covers all rework on Line 2, not only porosity at W3 and W4.',
      ],
    },
    recommendations: [
      'Use the 5.4% rate and the 3.4-point gap as the baseline for every later tool, and track the same rate weekly so the fix can be proved.',
      'Investigate first what changed at stations W3 and W4 around week 27, since that is where and when the problem starts.',
      'Rank the defect types with a Pareto chart before working on porosity alone, to confirm it is the biggest contributor.',
      'Agree the problem statement with the plant head and the quality lead so that everyone is solving the same problem.',
    ],
    actionables: [
      { action: 'Pull the station-by-station defect log for weeks 20 to 34 and mark week 27', owner: 'Quality Engineer', timeframe: 'This week', priority: 'High' },
      { action: 'List every change made to stations W3 and W4 between weeks 25 and 28 from the maintenance job cards', owner: 'Maintenance Lead', timeframe: 'This week', priority: 'High' },
      { action: 'Confirm that rework tagging did not change in week 27', owner: 'Quality Engineer', timeframe: 'Next 2 weeks', priority: 'Medium' },
      { action: 'Share the agreed problem statement with the anchor customer’s quality team', owner: 'Plant Head', timeframe: 'Next 2 weeks', priority: 'Low' },
    ],
  },
};
