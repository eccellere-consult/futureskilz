/**
 * problemSolving/story.ts — the "story bible" of the worked example: ONE problem told consistently through all twelve frameworks of the Problem
 * Solving section, so a client who opens the worked examples one after another sees a single case being solved, not twelve unrelated ones.
 *
 * The company is the fictional Anand Auto Components Pvt Ltd (Pune), the same fictional company the Strategy Hub samples use, and its figures
 * agree with them (revenue ₹9,800 lakh, 4.8% rework on Line 2). Every number the twelve samples quote comes from here, and story.test.ts proves
 * that the derived ones (percentages, totals, scores, quadrants) are what the data says.
 */

export const COMPANY = 'Anand Auto Components Pvt Ltd';
export const REVENUE_LAKH = 9800;

export const LINE2 = {
  part: 'Chassis bracket CB-210',
  outputAtCostLakh: 4750,
  reworkRate12m: 4.8,
  targetRate: 2,
  /** Last quarter, the figures the problem statement quotes. */
  quarter: { welded: 18700, reworked: 1008 },
  stations: ['W3', 'W4'] as const,
  sharedRegulatorSinceWeek: 27,
  rootCause: 'No utilities check exists when a welding station is added, so two torches were put on one gas regulator.',
  fix: 'A separate regulator and 12 mm line for each torch, plus a flow-meter alarm.',
} as const;

/** Cost of poor quality, ₹ lakh a year: the four classic categories (prevention, appraisal, internal failure, external failure) and what sits in each. */
export const COPQ = [
  { category: 'Internal failure', item: 'Rework on Line 2', lakh: 96 },
  { category: 'Appraisal', item: 'Inspection', lakh: 52 },
  { category: 'Prevention', item: 'Training and maintenance', lakh: 11 },
  { category: 'Internal failure', item: 'Scrap', lakh: 31 },
  { category: 'External failure', item: 'Returns and warranty', lakh: 38 },
] as const;

/** Defects found on Line 2 last quarter. */
export const PARETO = [
  { defect: 'Porosity at W3 and W4', count: 412 },
  { defect: 'Undercut', count: 238 },
  { defect: 'Spatter', count: 171 },
  { defect: 'Incomplete fusion', count: 96 },
  { defect: 'Crater cracks', count: 41 },
  { defect: 'Misalignment', count: 28 },
  { defect: 'Other', count: 22 },
] as const;

/** Pugh matrix: criteria with a weight (1 to 5), and each option against the datum "one torch at a time": better +1, same 0, worse −1. */
export const PUGH = {
  datum: 'One regulator for two torches (today)',
  criteria: [
    { name: 'Fixes the root cause', weight: 5, A: 1, B: 0, C: 1 },
    { name: 'Cost', weight: 4, A: -1, B: 1, C: -1 },
    { name: 'Time to put in place', weight: 3, A: 0, B: 1, C: -1 },
    { name: 'Risk to output during the change', weight: 3, A: 0, B: 1, C: 0 },
    { name: 'Skills we already have', weight: 2, A: 1, B: 1, C: 1 },
    { name: 'Prevents it for future stations', weight: 4, A: 1, B: -1, C: 1 },
  ],
  options: { A: 'A regulator and line for each torch', B: 'A flow-meter alarm on both stations', C: 'A robot welding cell' },
  chosen: 'A and B together',
} as const;

/** FMEA (lite): severity, occurrence, detection, each 1 to 10. RPN = S x O x D. */
export const FMEA = [
  { mode: 'Wrong wire lot loaded', s: 6, o: 4, d: 4 },
  { mode: 'Worn contact tip', s: 4, o: 6, d: 3 },
  { mode: 'Porosity from gas starvation (shared regulator)', s: 6, o: 6, d: 6 },
  { mode: 'Operator skips the pre-weld check', s: 7, o: 3, d: 5 },
  { mode: 'Fixture clamp wear lets the part shift', s: 7, o: 3, d: 6 },
  { mode: 'Leak at a new hose joint (after the fix)', s: 5, o: 2, d: 4 },
] as const;

/** Impact and effort of the candidate fixes, each 1 to 10 (a value above 5.5 is high). */
export const FIXES = [
  { fix: 'Regulator and 12 mm line for each torch', effort: 3, impact: 9 },
  { fix: 'Flow-meter alarm on both stations', effort: 2, impact: 7 },
  { fix: 'Utilities check in the station-add checklist', effort: 1, impact: 6 },
  { fix: 'Robot welding cell', effort: 9, impact: 9 },
  { fix: 'Repaint the bay markings', effort: 2, impact: 1 },
  { fix: 'Change the contact tip every week', effort: 3, impact: 3 },
  { fix: 'Retrain the night shift on the pre-weld check', effort: 4, impact: 4 },
  { fix: 'Change the wire supplier', effort: 5, impact: 2 },
] as const;

/** The PDCA trial: four weeks after the fix. */
export const TRIAL = [
  { week: 1, welded: 1100, reworked: 36 },
  { week: 2, welded: 1050, reworked: 27 },
  { week: 3, welded: 1100, reworked: 20 },
  { week: 4, welded: 1050, reworked: 16 },
] as const;

/** The five whys, as the team answered them. Each links to evidence; one is still an assumption. */
export const WHYS = [
  { why: 'Why is rework on Line 2 at 5.4%?', because: 'Porosity at W3 and W4 is 41% of all defects.', evidence: 'Defect log, last quarter', assumed: false },
  { why: 'Why is there porosity at W3 and W4?', because: 'The shielding gas flow drops when both torches fire.', evidence: 'Flow readings: 15 L/min falls to about 9 L/min', assumed: false },
  { why: 'Why does the flow drop?', because: 'Both torches share one regulator and one 8 mm line.', evidence: 'Walk-down of the station, photo on file', assumed: false },
  { why: 'Why do they share one?', because: 'W4 was added in week 27 for the second shift and tapped into the existing line.', evidence: 'Maintenance job card, week 27', assumed: false },
  { why: 'Why was a shared line accepted?', because: 'There is no utilities check when a station is added.', evidence: 'No such step in the station-add procedure', assumed: true },
] as const;
