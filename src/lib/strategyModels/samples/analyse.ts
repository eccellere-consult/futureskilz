/**
 * samples/analyse.ts — the worked example for 5 Whys, the same Line 2 weld problem as the 5W2H example. The chain is the
 * team's five whys from problemSolving/story.ts: four are evidenced and the fifth is still an assumption.
 */
import { LINE2, WHYS } from '../../problemSolving/story';
import type { ModelSample } from '../types';

export const ANALYSE_SAMPLES: Record<string, ModelSample> = {
  'five-whys': {
    scenario: 'Anand Auto Components (Pune) — the quality team asks why porosity at Line 2 stations W3 and W4 keeps coming back.',
    values: {
      problem: `Weld rework on the ${LINE2.part} at Line 2 is running at 5.4% of parts welded, against a ${LINE2.targetRate}% target.`,
      root_cause: LINE2.rootCause,
    },
    tables: {
      chain: WHYS.map((w, i) => ({
        why: `Why ${i + 1}`,
        answer: w.because,
        evidence: w.evidence,
        status: w.assumed ? 'Assumed' : 'Evidenced',
      })),
    },
    why: {
      problem: 'The chain starts from the problem exactly as 5W2H stated it, so both tools work on the same problem.',
      chain: 'Each answer is checked on the shop floor before the next why is asked; the last one is marked Assumed because nobody has yet read the station-add procedure end to end.',
      root_cause: 'The chain stops at a missing check in how stations are added, not at the maintenance fitter who tapped the line.',
    },
    analysis: {
      summary:
        'The chain runs from the 5.4% rework rate to a gap in how new stations are set up: when W4 was added in week 27 it was tapped into W3’s gas line, both torches now share one regulator, and the gas flow drops when both fire. Four of the five links are evidenced by defect logs, flow readings, a walk-down and a job card. The fifth, that no utilities check exists when a station is added, is still an assumption and must be confirmed before the fix is designed.',
      verdict: {
        label: 'Root cause found, one link to confirm',
        rationale: 'The chain ends on a system gap whose fix would stop recurrence, but the final link is assumed, so it must be checked against the station-add procedure.',
      },
      findings: [
        { title: 'The chain ends on a system, not a person', detail: 'It stops at a missing utilities check, which explains why the shared line was accepted without blaming the fitter who made it.' },
        { title: 'The physical cause is measured', detail: 'Flow readings fall from 15 to about 9 litres a minute when both torches fire, which is enough to explain porosity at W3 and W4.' },
        { title: 'It matches the 5W2H facts', detail: 'Week 27 (when W4 was added) and stations W3 and W4 are exactly the time and place 5W2H isolated.' },
        { title: 'Only one link is unproved', detail: 'One of five answers is still an assumption: the absence of a utilities check in the station-add procedure.' },
      ],
      watchouts: [
        'If the station-add procedure does include a utilities check that was skipped, the root cause becomes “the check is not enforced”, and the fix changes.',
        'Separate regulators fix W3 and W4, but other stations added the same way may share lines too.',
        'Porosity is 41% of defects, not all of them: the other defect types still need their own analysis.',
      ],
    },
    recommendations: [
      'Confirm the fifth link by reading the station-add procedure and the week-27 change request before designing the fix.',
      'Give W3 and W4 a regulator and gas line each, and add a flow-meter alarm so a drop is seen before parts are welded.',
      'Add a utilities check (gas, power, air) to the station-add procedure so the same gap cannot recur on another line.',
      'Walk every other station added in the last two years to check whether it shares a gas line.',
    ],
    actionables: [
      { action: 'Read the station-add procedure and the week-27 change request, and confirm or correct Why 5', owner: 'Quality Engineer', timeframe: 'This week', priority: 'High' },
      { action: 'Fit a separate regulator and 12 mm line to W4, with a flow-meter alarm on both stations', owner: 'Maintenance Lead', timeframe: 'Next 2 weeks', priority: 'High' },
      { action: 'Add a utilities sign-off to the station-add procedure', owner: 'Plant Head', timeframe: 'This month', priority: 'Medium' },
      { action: 'Check gas lines at every station added since 2024', owner: 'Maintenance Lead', timeframe: 'This quarter', priority: 'Low' },
    ],
  },
};
