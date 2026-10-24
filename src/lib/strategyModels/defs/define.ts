/**
 * defs/define.ts — the Problem Solving section's Define stage: 5W2H, the first tool of the thread. (Cost of Poor Quality is
 * added here in the next part of the build.)
 *
 * Labels are the method's own names and are the saved ids (references/01 §4): never rename one without a legacyLabels entry.
 * The field labels are deliberately general ("How many had the problem", not "Parts reworked") because FutureSkilz learners
 * bring problems from every kind of work; the worked example tells the factory story.
 */
import { col, long, num, section, table } from '../build';
import { fmtNum, toNum } from '../values';
import type { ModelDefinition, ModelValues, Row } from '../types';

const rows = (v: ModelValues, key: string): Row[] => v.tables[key] ?? [];

// ── 5W2H ─────────────────────────────────────────────────────────────────────

export const FIVE_W_TWO_H = ['What', 'Why', 'Where', 'When', 'Who', 'How', 'How much'] as const;

/** How often the problem happens now, as a percentage of everything in the period. Null until both counts make sense. */
export function problemRate(v: ModelValues): number | null {
  const total = toNum(v.fields.total), affected = toNum(v.fields.affected);
  if (total === null || affected === null || total <= 0 || affected < 0 || affected > total) return null;
  return (affected / total) * 100;
}

/** Percentage points between the rate now and the target (positive = above target). Null until both are known. */
export function gapToTarget(v: ModelValues): number | null {
  const rate = problemRate(v), target = toNum(v.fields.target);
  return rate === null || target === null ? null : Number(fmtNum(rate, 1)) - target;
}

const answerOf = (v: ModelValues, question: (typeof FIVE_W_TWO_H)[number]): string =>
  rows(v, 'questions').find((r) => r.question === question)?.answer?.trim() ?? '';

/** The problem statement the next tools take: the person's one sentence, or else the What and the How much joined. */
export function problemStatement(v: ModelValues): string | null {
  const sentence = v.fields.problem?.trim();
  if (sentence) return sentence;
  const joined = [answerOf(v, 'What'), answerOf(v, 'How much')].filter(Boolean).join(' — ');
  return joined || null;
}

const fiveW2H: ModelDefinition = {
  toolId: '5w2h',
  reference: {
    originator: 'Traditional method (no single originator)',
    year: 'Traditional',
    summary:
      'Describes a problem completely before anyone tries to solve it, by answering seven plain questions: what, why, where, when, who, how and how much. It turns a complaint into a statement with facts, a place, a time and a size.',
    caption: 'The seven questions surround the problem: every answer is a fact you can check, not a guess at the cause.',
    howToRead: [
      'Start in the centre with the problem in one sentence, then answer each question around it with what you have seen, not what you think caused it.',
      'Where, when and how much give the problem a place, a time and a size; without them nobody can tell later whether it is fixed.',
      'If an answer names a cause or a solution, move it out: this tool describes the problem, the next tools explain it.',
    ],
  },
  sections: [
    section('problem', 'The problem', 'Say what is wrong in one sentence, and how big it is in numbers.',
      long('problem', 'The problem in one sentence', 'What is wrong, where and since when, in words anyone in the business would recognise. A fact, not a cause or a fix.', 'Late deliveries to our largest customer have doubled since April'),
      num('total', 'Total in the period', 'Everything that went through in the period you are describing: parts made, orders shipped, tickets handled, invoices raised.', 'count', '2,400'),
      num('affected', 'How many had the problem', 'How many of that total had the problem: reworked, late, rejected, complained about.', 'count', '180'),
      num('target', 'Target rate', 'The rate you are aiming for, as a percentage of the total. Use the target the business has set, or the rate you had before the problem started.', '%', '2')),
    section('questions', 'The seven questions', 'Answer each question with what you have seen, and say how you know.',
      table('questions', 'Seven questions', 'One row per question of 5W2H.', 'Question', [
        col.text('question', 'Question', 'The 5W2H question.'),
        col.long('answer', 'Answer', 'What you have seen: a fact about the problem, not its cause or its fix.'),
        col.long('evidence', 'How we know', 'Where the answer comes from: a log, a report, a count, an observation, a complaint.'),
      ], {
        fixed: FIVE_W_TWO_H,
        hints: {
          What: 'What exactly is wrong: the part, product, service or step, and the defect or failure you see',
          Why: 'Why it matters: the cost, the customer impact or the risk if nothing changes (not why it happens)',
          Where: 'Where it shows up: the line, station, branch, customer or step in the process, and where it does not',
          When: 'When it started and when it happens: since which week, which shift, which season, how often',
          Who: 'Who sees it or is affected by it: customers, teams, roles (people involved, not people to blame)',
          How: 'How it shows up and how it was found: the symptom, the check or the complaint that revealed it',
          'How much': 'How big it is: how many, how often, what it costs, against what target',
        },
      })),
  ],
  derived: [
    {
      key: 'rate_now',
      label: 'Problem rate now',
      help: 'How many had the problem ÷ total in the period.',
      compute: (v) => { const r = problemRate(v); return r === null ? null : `${fmtNum(r, 1)}%`; },
    },
    {
      key: 'gap',
      label: 'Gap to the target',
      help: 'Problem rate now minus the target rate, in percentage points.',
      compute: (v) => {
        const g = gapToTarget(v);
        if (g === null) return null;
        return g > 0 ? `${fmtNum(g, 1)} points above the target` : g < 0 ? `${fmtNum(-g, 1)} points better than the target` : 'On the target';
      },
      tone: (v) => { const g = gapToTarget(v); return g === null ? undefined : g > 0 ? 'warn' : 'good'; },
    },
  ],
  outputs: [
    { key: 'problem_statement', label: 'Problem statement', compute: problemStatement },
    { key: 'rate_now', label: 'Problem rate now', compute: (v) => { const r = problemRate(v); return r === null ? null : `${fmtNum(r, 1)}%`; } },
    { key: 'target_rate', label: 'Target rate', compute: (v) => { const t = toNum(v.fields.target); return t === null ? null : `${fmtNum(t, 1)}%`; } },
    { key: 'where', label: 'Where the problem shows up', compute: (v) => answerOf(v, 'Where') || null },
  ],
  analysisGuide:
    'The verdict is whether the problem is now stated well enough to analyse: with a number, a place and a time, and with a target to measure the fix against. ' +
    'Use the worked-out problem rate and gap as given. Check each of the seven answers: flag any that is really a cause ("because the operators are careless") or a solution in disguise ("we need a new machine"), and say where it belongs instead. ' +
    'Flag an answer with no evidence, a "Who" that blames a person rather than naming who is affected, and a "Where" or "When" that does not also say where or when the problem does NOT happen, because that contrast is what the next tools use.',
};

export const DEFINE_MODELS: ModelDefinition[] = [fiveW2H];
