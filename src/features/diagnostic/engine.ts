import { skillFamilies, type SkillFamilyId } from "../../domain/skills/taxonomy";
import type { SkillEstimate } from "../pathway/estimate";
import type { TargetRole } from "../pathway/roles";
import { OUTCOME_OPTIONS, QUESTIONS, REPORTED_BEHAVIOUR_CONFIDENCE, SELF_REPORT_CONFIDENCE_CAP, questionById, type DiagnosticQuestion } from "./questions";

/**
 * The adaptive part. Given what the learner has answered, the engine decides what to ask next, or that it has heard enough.
 * Rules, not a model: the same answers always give the same next question, so a result can be explained and tested.
 *
 *  1. Cover the capability families that matter most for the target role first (all six when there is no target role),
 *     one question each: the shortest credible route is four questions.
 *  2. Ask a family's second question only when it can change the diagnosis: the first answer conflicts with the baseline,
 *     or the family holds a core skill for the role.
 *  3. After a strong claim, ask what came of it. Results are firmer evidence than a description of what someone did.
 *  4. Stop at a fixed ceiling so the conversation never drags.
 */
export type DiagnosticAnswer = {
  questionId: string;
  /** Index of the option chosen, or null for "I have not been in this situation recently" (no evidence, not a low level). */
  option: number | null;
  /** Index into OUTCOME_OPTIONS, once the follow-up has been asked. */
  outcome?: number;
};

export type DiagnosticContext = {
  role?: TargetRole;
  /** What the baseline already says, so a large disagreement is noticed and probed. */
  baseline?: Map<string, SkillEstimate>;
};

export type NextPrompt =
  | { kind: "core"; question: DiagnosticQuestion; progress: Progress }
  | { kind: "outcome"; question: DiagnosticQuestion; chosen: string; progress: Progress }
  | { kind: "done"; progress: Progress };

export type Progress = { answered: number; estimatedTotal: number };

export const MIN_FAMILIES = 4;
export const MAX_CORE = 8;
export const MAX_OUTCOMES = 3;
export const MAX_PROMPTS = 12;
const CONFLICT = 1.5;
const STRONG_CLAIM = 3.5;

const familyOf = (id: SkillFamilyId) => skillFamilies.find((family) => family.id === id)!;
const FAMILY_ORDER: SkillFamilyId[] = skillFamilies.map((family) => family.id);

const levelOf = (answer: DiagnosticAnswer): number | null => {
  const question = questionById(answer.questionId);
  if (!question || answer.option === null) return null;
  return question.options[answer.option]?.level ?? null;
};

/** How much a question matters for this role: what the role needs from the skills it gives evidence about. */
export function relevance(question: DiagnosticQuestion, role?: TargetRole): number {
  if (!role) return 0;
  return question.skills.reduce((sum, item) => {
    const need = role.requirements.find((requirement) => requirement.skill === item.skill);
    return sum + (need ? need.criticality * need.level * item.weight : 0);
  }, 0);
}

export function familyOrder(role?: TargetRole): SkillFamilyId[] {
  const score = (family: SkillFamilyId) => QUESTIONS.filter((question) => question.family === family).reduce((sum, question) => sum + relevance(question, role), 0);
  return [...FAMILY_ORDER].sort((a, b) => score(b) - score(a) || FAMILY_ORDER.indexOf(a) - FAMILY_ORDER.indexOf(b));
}

const questionsOf = (family: SkillFamilyId, role?: TargetRole) =>
  QUESTIONS.filter((question) => question.family === family).sort((a, b) => relevance(b, role) - relevance(a, role) || QUESTIONS.indexOf(a) - QUESTIONS.indexOf(b));

function conflicts(answer: DiagnosticAnswer, context: DiagnosticContext): boolean {
  const question = questionById(answer.questionId);
  const level = levelOf(answer);
  if (!question || level === null || !context.baseline) return false;
  return question.skills.some((item) => {
    const estimate = context.baseline!.get(item.skill);
    return item.weight >= 0.5 && estimate?.level != null && Math.abs(estimate.level - level) >= CONFLICT;
  });
}

const isCoreSkillFor = (question: DiagnosticQuestion, role?: TargetRole): boolean =>
  Boolean(role) && question.skills.some((item) => item.weight >= 0.5 && role!.requirements.some((requirement) => requirement.skill === item.skill && requirement.criticality === 3 && requirement.level >= 3));

function wantsOutcome(answer: DiagnosticAnswer, role?: TargetRole): boolean {
  const question = questionById(answer.questionId);
  const level = levelOf(answer);
  if (!question || level === null || answer.outcome !== undefined) return false;
  return level >= STRONG_CLAIM || (level >= 3 && isCoreSkillFor(question, role));
}

export function nextPrompt(answers: DiagnosticAnswer[], context: DiagnosticContext = {}): NextPrompt {
  const asked = new Set(answers.map((answer) => answer.questionId));
  const outcomesAsked = answers.filter((answer) => answer.outcome !== undefined).length;
  const progress = (planned: number): Progress => ({ answered: answers.length + outcomesAsked, estimatedTotal: Math.max(planned, answers.length + outcomesAsked) });
  if (answers.length + outcomesAsked >= MAX_PROMPTS) return { kind: "done", progress: progress(0) };

  // 3. A strong claim is followed at once by what came of it, so the conversation stays about one situation at a time.
  const pending = answers.find((answer) => wantsOutcome(answer, context.role));
  if (pending && outcomesAsked < MAX_OUTCOMES) {
    const question = questionById(pending.questionId)!;
    return { kind: "outcome", question, chosen: question.options[pending.option!].text, progress: progress(answers.length + 1) };
  }

  const order = familyOrder(context.role);
  const relevantFamilies = context.role ? order.filter((family) => QUESTIONS.some((question) => question.family === family && relevance(question, context.role) > 0)) : order;
  const target = (relevantFamilies.length >= MIN_FAMILIES ? relevantFamilies : order).slice(0, context.role ? Math.max(MIN_FAMILIES, Math.min(6, relevantFamilies.length)) : 6);
  const core = answers.length;

  // 1. One question for each family worth covering, most relevant first.
  for (const family of target) {
    const [first] = questionsOf(family, context.role);
    if (first && !asked.has(first.id)) return { kind: "core", question: first, progress: progress(plannedTotal(answers, context, target)) };
  }

  // 2. A second question only where it can change the diagnosis.
  if (core < MAX_CORE) {
    for (const family of target) {
      const [first, second] = questionsOf(family, context.role);
      if (!second || asked.has(second.id)) continue;
      const firstAnswer = answers.find((answer) => answer.questionId === first.id);
      if (firstAnswer && (conflicts(firstAnswer, context) || isCoreSkillFor(second, context.role))) {
        return { kind: "core", question: second, progress: progress(plannedTotal(answers, context, target)) };
      }
    }
  }
  return { kind: "done", progress: progress(0) };
}

function plannedTotal(answers: DiagnosticAnswer[], context: DiagnosticContext, target: SkillFamilyId[]): number {
  const extra = answers.filter((answer) => wantsOutcome({ ...answer, outcome: undefined }, context.role)).length;
  return Math.min(MAX_PROMPTS, target.length + extra + 1);
}

export type EvidenceKind = "reported-behaviour" | "reported-behaviour-with-result";
export type DiagnosticSkill = { skill: string; level: number; confidence: number; kind: EvidenceKind; answers: number };
export type DiagnosticResult = { skills: DiagnosticSkill[]; noSituation: string[]; answered: number };

/**
 * Turns answers into per-skill levels. Several answers about the same skill combine by weight; confidence grows with agreement
 * and with results, and never passes the self-report ceiling. A "no recent situation" answer adds nothing and is listed, so the
 * summary can say what is still unknown.
 */
export function scoreDiagnostic(answers: DiagnosticAnswer[]): DiagnosticResult {
  const parts = new Map<string, Array<{ level: number; weight: number; confidence: number; withResult: boolean }>>();
  const noSituation: string[] = [];
  for (const answer of answers) {
    const question = questionById(answer.questionId);
    if (!question) continue;
    const level = levelOf(answer);
    if (level === null) {
      noSituation.push(question.id);
      continue;
    }
    const outcome = answer.outcome === undefined ? undefined : OUTCOME_OPTIONS[answer.outcome];
    const confidence = outcome ? outcome.confidence : REPORTED_BEHAVIOUR_CONFIDENCE;
    for (const item of question.skills) {
      const list = parts.get(item.skill) ?? [];
      list.push({ level, weight: item.weight, confidence: confidence * item.weight + 0.0, withResult: Boolean(outcome && outcome.confidence >= 0.45) });
      parts.set(item.skill, list);
    }
  }
  const skills: DiagnosticSkill[] = [...parts].map(([skill, list]) => {
    const weights = list.reduce((sum, item) => sum + item.weight * item.confidence, 0);
    const level = list.reduce((sum, item) => sum + item.level * item.weight * item.confidence, 0) / (weights || 1);
    const confidence = Math.min(SELF_REPORT_CONFIDENCE_CAP, 1 - list.reduce((product, item) => product * (1 - item.confidence), 1));
    return { skill, level: Number(level.toFixed(2)), confidence: Number(confidence.toFixed(2)), kind: list.some((item) => item.withResult) ? "reported-behaviour-with-result" : "reported-behaviour", answers: list.length };
  });
  return { skills: skills.sort((a, b) => a.skill.localeCompare(b.skill)), noSituation, answered: answers.length };
}

export const FAMILY_NAME = (family: SkillFamilyId): string => familyOf(family).name;
