/**
 * defs/analyse.ts — the Problem Solving section's Analyse stage: 5 Whys. (Pareto, Is / Is-Not, the affinity diagram and the
 * fishbone are added here in the next parts of the build.)
 */
import { col, long, section, table } from '../build';
import type { ModelDefinition, ModelValues, Row } from '../types';

const rows = (v: ModelValues, key: string): Row[] => v.tables[key] ?? [];

// ── 5 Whys ───────────────────────────────────────────────────────────────────

export const WHY_ROWS = ['Why 1', 'Why 2', 'Why 3', 'Why 4', 'Why 5'] as const;
export const WHY_STATUS = ['Evidenced', 'Assumed'] as const;

/** The answered links of the chain, in order: rows with an answer. */
const answeredLinks = (v: ModelValues): Row[] => rows(v, 'chain').filter((r) => (r.answer ?? '').trim());

/** How many answered links are still assumptions, out of how many are answered. Null until one link is answered. */
export function assumptionCount(v: ModelValues): { assumed: number; answered: number } | null {
  const answered = answeredLinks(v);
  if (answered.length === 0) return null;
  return { assumed: answered.filter((r) => r.status === 'Assumed').length, answered: answered.length };
}

const fiveWhys: ModelDefinition = {
  toolId: 'five-whys',
  reference: {
    originator: 'Sakichi Toyoda (Toyota); set out by Taiichi Ohno in “Toyota Production System: Beyond Large-Scale Production”',
    year: '1988',
    summary:
      'Finds the root cause of a problem by asking “why?” again and again, each time of the answer before, until the answer is something in the way work is set up that you can change so the problem does not come back.',
    caption: 'Each answer becomes the next question. The chain stops at a gap in a system, not at a person.',
    howToRead: [
      'Start from the problem as 5W2H stated it, and ask why it happens. Then ask why that answer is true, and so on.',
      'Five is a guide, not a rule: stop when fixing the answer would stop the problem recurring, which may take three whys or seven.',
      'Mark each answer Evidenced or Assumed. A chain that rests on assumptions has to be checked before anyone acts on it.',
    ],
  },
  sections: [
    section('start', 'The problem', 'The problem the chain starts from, stated as a fact.',
      long('problem', 'The problem', 'The problem as 5W2H stated it: what, where and how much. The first why asks why this happens.', 'Late deliveries to our largest customer have doubled since April', { prefill: { upstream: '5w2h', output: 'problem_statement' } })),
    section('chain', 'The chain of whys', 'Ask why of each answer in turn, and say how you know.',
      table('chain', 'Chain of whys', 'One row per why, each asking why the answer before it is true.', 'Why', [
        col.text('why', 'Why', 'The step in the chain.'),
        col.long('answer', 'Because…', 'The answer to this why: what is true that makes the step before it happen.'),
        col.long('evidence', 'How we know', 'What shows the answer is true: a measurement, a record, a walk-down, a document.'),
        col.select('status', 'Evidenced or assumed', 'Evidenced when you have checked it; Assumed when it still has to be proved.', WHY_STATUS),
      ], {
        fixed: WHY_ROWS,
        hints: {
          'Why 1': 'Why does the problem happen? Answer with what you can see, not a guess',
          'Why 2': 'Why is the answer to Why 1 true?',
          'Why 3': 'Why is the answer to Why 2 true?',
          'Why 4': 'Why is the answer to Why 3 true?',
          'Why 5': 'Why is the answer to Why 4 true? If fixing this would stop the problem coming back, it is the root cause',
        },
      })),
    section('root', 'The root cause', 'What the chain found.',
      long('root_cause', 'The root cause', 'The root cause, stated as a gap in a system (a missing check, step, standard or rule), not as a person who made a mistake.', 'Nobody re-plans delivery dates when an order is changed')),
  ],
  derived: [
    {
      key: 'assumed',
      label: 'Answers still assumed',
      help: 'Answered whys marked Assumed. More than one means the chain needs checking before acting on it.',
      compute: (v) => {
        const c = assumptionCount(v);
        if (!c) return null;
        return `${c.assumed} of ${c.answered} answer${c.answered === 1 ? '' : 's'} ${c.assumed === 1 ? 'is still an assumption' : 'are still assumptions'}`;
      },
      tone: (v) => { const c = assumptionCount(v); return !c ? undefined : c.assumed > 1 ? 'warn' : 'good'; },
    },
  ],
  outputs: [
    { key: 'root_cause', label: 'Root cause', compute: (v) => v.fields.root_cause?.trim() || null },
    { key: 'assumed_count', label: 'Answers still assumed', compute: (v) => { const c = assumptionCount(v); return c ? `${c.assumed} of ${c.answered}` : null; } },
  ],
  analysisGuide:
    'The verdict is whether the chain has reached a root cause you can act on: a gap in how work is set up (a missing check, standard, step or rule) whose fix would stop the problem recurring. ' +
    'Reject a chain that ends on a person ("the operator forgot", "lack of attention"); say which system question to ask instead. Check that each why really answers the one before it and does not jump ahead. ' +
    'Use the count of assumed answers as given: name each assumed link and say what evidence would prove or disprove it before money is spent on a fix. Say whether the root cause is consistent with the problem statement and the earlier tools.',
};

export const ANALYSE_MODELS: ModelDefinition[] = [fiveWhys];
