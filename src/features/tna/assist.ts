import { z } from "zod";

import { proficiencies, type Proficiency } from "./types";

/**
 * Help while a coach fills in the start of a training plan: from the little they have typed, the AI proposes the rest and asks
 * the few questions whose answers would change it. Everything is a suggestion in the coach's fields to read and change.
 */
export const assistInputSchema = z.object({
  topic: z.string().trim().min(4, "Say what the training is about first.").max(300),
  role: z.string().trim().max(160).optional(),
  level: z.enum(proficiencies).optional(),
  language: z.string().trim().max(40).optional(),
  goal: z.string().trim().max(600).optional(),
  minutesPerLearner: z.number().int().min(10).max(6000).optional(),
  notes: z.string().trim().max(600).optional(),
  context: z.string().trim().max(4000).optional(),
  /** Questions already answered: they are never asked again. */
  answers: z.array(z.object({ question: z.string().trim().min(1).max(300), answer: z.string().trim().min(1).max(400) })).max(8).default([]),
});
export type AssistInput = z.infer<typeof assistInputSchema>;

const textOrNull = (max: number) => z.string().trim().max(max).nullish().transform((value) => value || undefined);

export const assistSuggestionsSchema = z.object({
  role: textOrNull(160),
  level: z.enum(proficiencies).nullish().transform((value) => value ?? undefined),
  goal: textOrNull(600),
  minutesPerLearner: z.number().int().min(10).max(6000).nullish().transform((value) => value ?? undefined),
  notes: textOrNull(600),
});
export type AssistSuggestions = { role?: string; level?: Proficiency; goal?: string; minutesPerLearner?: number; notes?: string };

export const assistQuestionSchema = z.object({
  question: z.string().trim().min(8).max(200),
  why: z.string().trim().max(240).default(""),
  options: z.array(z.string().trim().min(1).max(80)).min(2).max(5),
});
export type AssistQuestion = z.infer<typeof assistQuestionSchema>;

export const assistReplySchema = z.object({
  suggestions: assistSuggestionsSchema.nullish().transform((value): AssistSuggestions => value ?? {}),
  questions: z.array(assistQuestionSchema).max(3).default([]),
});

export type AssistResult = { suggestions: AssistSuggestions; questions: AssistQuestion[]; source: "ai" | "scaffold"; notes: string[] };

/** The fields a suggestion may fill. */
export const ASSIST_FIELDS = ["role", "level", "goal", "minutesPerLearner", "notes"] as const;
export type AssistField = (typeof ASSIST_FIELDS)[number];

/**
 * Puts suggestions into the form without ever overwriting what the person typed: a field is filled when it is empty or when an
 * earlier suggestion filled it. Returns the new values and which fields now hold a suggestion.
 */
export function mergeSuggestions<T extends Partial<Record<AssistField, string | number | undefined>>>(current: T, aiFilled: ReadonlySet<AssistField>, suggestions: AssistSuggestions): { values: T; aiFilled: Set<AssistField> } {
  const values = { ...current } as Record<AssistField, string | number | undefined>;
  const filled = new Set(aiFilled);
  for (const field of ASSIST_FIELDS) {
    const next = suggestions[field];
    if (next === undefined || next === "") continue;
    const now = values[field];
    const empty = now === undefined || now === "";
    if (empty || filled.has(field)) {
      values[field] = next;
      filled.add(field);
    }
  }
  return { values: values as T, aiFilled: filled };
}

/* ---- The plain fallback: no AI answers, so ask the questions every coach can answer by tapping, and turn the taps into entries. ---- */

const WHO = "Who will be in the room?";
const PROBLEM = "What is going wrong today that this training should fix?";
const TIME = "How much time can each learner give in total?";

const WHO_OPTIONS = ["Shop-floor operators", "First-line supervisors", "Managers and leaders", "Office and support staff", "A mixed group"];
const PROBLEM_OPTIONS = ["Too many mistakes or rework", "Work is slow or delayed", "Customers or clients complain", "People do not follow the agreed way", "New people take too long to get up to speed"];
const TIME_OPTIONS: Array<[string, number]> = [["About 1 hour", 60], ["About half a day", 240], ["About 2 days", 960], ["About a week", 2400]];

const answerOf = (input: AssistInput, question: string) => input.answers.find((item) => item.question === question)?.answer;

export function scaffoldAssist(input: AssistInput): AssistResult {
  const suggestions: AssistSuggestions = {};
  const questions: AssistQuestion[] = [];
  const who = answerOf(input, WHO);
  const problem = answerOf(input, PROBLEM);
  const time = answerOf(input, TIME);
  if (!input.role) {
    if (who) {
      suggestions.role = who;
      suggestions.level = who === "Managers and leaders" ? "working" : "foundational";
    } else questions.push({ question: WHO, why: "The right pieces and examples depend on who is learning.", options: WHO_OPTIONS });
  }
  if (!input.goal) {
    if (problem) suggestions.goal = `Fewer cases of this problem at work: ${problem.toLowerCase()}.`;
    else questions.push({ question: PROBLEM, why: "A training is planned backwards from a result you could see at work.", options: PROBLEM_OPTIONS });
  }
  if (!input.minutesPerLearner) {
    const minutes = TIME_OPTIONS.find(([label]) => label === time)?.[1];
    if (minutes) suggestions.minutesPerLearner = minutes;
    else questions.push({ question: TIME, why: "It decides how many small pieces the topic can be cut into.", options: TIME_OPTIONS.map(([label]) => label) });
  }
  return { suggestions, questions: questions.slice(0, 3), source: "scaffold", notes: ["No AI answered, so these are plain questions and your answers are copied into the boxes. Edit them freely."] };
}
