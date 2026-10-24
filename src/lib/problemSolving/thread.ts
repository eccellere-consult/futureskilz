/**
 * problemSolving/thread.ts — the golden thread of the Problem Solving section, as data: the stage of each tool, which tool feeds which, the
 * outputs each one declares, the one-click suggestions (prefills) a field offers, and the words each reference diagram must say.
 *
 * The seed reads FEEDS and STAGE_OF. Each framework definition must agree with OUTPUTS (its `outputs` keys) and PREFILLS (its fields'
 * `prefill`); thread.test.ts proves the data is consistent with the engine's own rules (a link declared on one side counts on both, a field may
 * prefill only from a tool it builds on and only from an output that tool has, the thread has no loop), and the section's content test proves
 * each definition matches this data.
 */
export const STAGES = ['Define', 'Analyse', 'Decide', 'Act', 'Document'] as const;
export type Stage = (typeof STAGES)[number];

export const TOOL_IDS = ['5w2h', 'copq', 'pareto', 'is-is-not', 'affinity', 'fishbone', 'five-whys', 'impact-effort', 'pugh', 'fmea-lite', 'pdca', 'a3'] as const;
export type ToolId = (typeof TOOL_IDS)[number];

export const STAGE_OF: Record<ToolId, Stage> = {
  '5w2h': 'Define', copq: 'Define',
  pareto: 'Analyse', 'is-is-not': 'Analyse', affinity: 'Analyse', fishbone: 'Analyse', 'five-whys': 'Analyse',
  'impact-effort': 'Decide', pugh: 'Decide', 'fmea-lite': 'Decide',
  pdca: 'Act',
  a3: 'Document',
};

/** One side of each link is enough: the engine's effectiveLinks() folds in the other side. */
export const FEEDS: Record<ToolId, ToolId[]> = {
  '5w2h': ['pareto', 'copq', 'is-is-not', 'fishbone', 'five-whys', 'pdca', 'a3'],
  copq: ['impact-effort', 'pugh', 'a3'],
  pareto: ['is-is-not', 'fishbone', 'a3'],
  'is-is-not': ['fishbone', 'five-whys'],
  affinity: ['fishbone'],
  fishbone: ['five-whys'],
  'five-whys': ['impact-effort', 'pugh', 'a3'],
  'impact-effort': ['pugh', 'fmea-lite'],
  pugh: ['fmea-lite', 'pdca', 'a3'],
  'fmea-lite': ['pdca', 'a3'],
  pdca: ['a3'],
  a3: [],
};

/** The named results each tool offers to the tools it feeds (the `outputs` keys of its definition). */
export const OUTPUTS: Record<ToolId, string[]> = {
  '5w2h': ['problem_statement', 'rate_now', 'target_rate', 'where'],
  copq: ['total_copq', 'pct_revenue', 'biggest_category'],
  pareto: ['top_defect', 'top_three_share'],
  'is-is-not': ['distinctions', 'changes'],
  affinity: ['groups', 'largest_group'],
  fishbone: ['verified_causes', 'most_likely'],
  'five-whys': ['root_cause', 'assumed_count'],
  'impact-effort': ['quick_wins', 'best_quick_win', 'major_projects'],
  pugh: ['chosen', 'top_option', 'scores'],
  'fmea-lite': ['top_risk', 'risks_over_100'],
  pdca: ['result_rate', 'improvement', 'decision'],
  a3: ['a3_complete'],
};

export interface PrefillSpec { tool: ToolId; field: string; from: ToolId; output: string }

/** The one-click suggestions: a field of `tool` offers the `output` of `from`. */
export const PREFILLS: PrefillSpec[] = [
  { tool: 'is-is-not', field: 'problem', from: '5w2h', output: 'problem_statement' },
  { tool: 'fishbone', field: 'effect', from: '5w2h', output: 'problem_statement' },
  { tool: 'five-whys', field: 'problem', from: '5w2h', output: 'problem_statement' },
  { tool: 'impact-effort', field: 'goal', from: 'five-whys', output: 'root_cause' },
  { tool: 'pugh', field: 'option_a', from: 'impact-effort', output: 'best_quick_win' },
  { tool: 'pdca', field: 'baseline', from: '5w2h', output: 'rate_now' },
  { tool: 'a3', field: 'background', from: '5w2h', output: 'problem_statement' },
  { tool: 'a3', field: 'current_condition', from: 'pareto', output: 'top_three_share' },
  { tool: 'a3', field: 'goal', from: '5w2h', output: 'target_rate' },
  { tool: 'a3', field: 'root_cause_analysis', from: 'five-whys', output: 'root_cause' },
  { tool: 'a3', field: 'countermeasures', from: 'pugh', output: 'chosen' },
  { tool: 'a3', field: 'follow_up', from: 'pdca', output: 'result_rate' },
];

/** What each reference diagram must say (lower case): the method's own element names, checked by the content test against the drawing. */
export const EXPECTED_ON_DIAGRAM: Record<ToolId, string[]> = {
  '5w2h': ['what', 'why', 'where', 'when', 'who', 'how', 'how much', 'the problem'],
  copq: ['prevention', 'appraisal', 'internal failure', 'external failure'],
  pareto: ['count', 'cumulative', '80%', 'vital few', 'useful many'],
  'is-is-not': ['what', 'where', 'when', 'extent', 'is', 'is not', 'distinctions', 'changes'],
  affinity: ['ideas', 'groups', 'header'],
  fishbone: ['effect', 'machine', 'method', 'material', 'manpower', 'measurement', 'environment'],
  'five-whys': ['why 1', 'why 2', 'why 3', 'why 4', 'why 5', 'root cause'],
  'impact-effort': ['quick win', 'major project', 'fill-in', 'avoid', 'effort', 'impact'],
  pugh: ['criteria', 'weight', 'datum', 'total', 'better', 'same', 'worse'],
  'fmea-lite': ['failure mode', 'severity', 'occurrence', 'detection', 'rpn'],
  pdca: ['plan', 'do', 'check', 'act'],
  a3: ['background', 'current condition', 'goal', 'root cause analysis', 'countermeasures', 'implementation plan', 'follow-up'],
};
