import { PHASE_LABELS } from "./question-bank";
import type { InterviewPlan, PhaseId, PlanMode } from "./types";

/** Arya's outline, in plain words. Required parts hold the interview together; optional parts can be left out. */
export type PlanPhase = { phase: PhaseId; label: string; purpose: string; minutes: number; required: boolean };

const outline = (phase: PhaseId, purpose: string, minutes: number, required = false): PlanPhase => ({ phase, label: PHASE_LABELS[phase], purpose, minutes, required });

export const PLAN_PHASES: PlanPhase[] = [
  outline("A", "What you want learners to take from your experience, and what is off limits.", 4, true),
  outline("B", "How you started, and what a newcomer needs on day one.", 5, true),
  outline("C", "Your jobs in order, so everything else has a place to sit.", 6, true),
  outline("F", "What you actually did in each job.", 6, true),
  outline("D", "The industry and business you worked in.", 4),
  outline("E", "How the organisation and its work flow fitted together.", 4),
  outline("G", "Step-by-step how-tos for the processes you ran.", 10),
  outline("H", "How performance was measured, and what moved it.", 6),
  outline("K", "Stories and turning points worth learning from.", 6),
  outline("M", "Judgement calls and know-how that is hard to write down.", 8),
  outline("I", "What the best performers did differently.", 5),
  outline("J", "Leading people and working in teams.", 5),
  outline("N", "How you would train a newcomer.", 5),
  outline("L", "The leaders and mentors who shaped you.", 3, true),
  outline("O", "A summary you check before anything is written up.", 3, true),
];

export const OPTIONAL_PHASES: PhaseId[] = PLAN_PHASES.filter((item) => !item.required).map((item) => item.phase);

/** Rough time for the plan as chosen, per job explored. Honest about being an estimate. */
export function planMinutes(skipPhases: PhaseId[]): number {
  return PLAN_PHASES.filter((item) => !skipPhases.includes(item.phase)).reduce((sum, item) => sum + item.minutes, 0);
}

export const ARYA_PLAN: InterviewPlan = { mode: "arya", skipPhases: [], topics: [] };

const MODES: PlanMode[] = ["arya", "edit", "self"];

/** Builds a plan from what the expert picked. `selected` are the optional parts they want; everything else optional is left out. */
export function planFromSelection(mode: PlanMode, selected: PhaseId[], topics: string[]): InterviewPlan {
  const wanted = mode === "arya" ? OPTIONAL_PHASES : OPTIONAL_PHASES.filter((phase) => selected.includes(phase));
  return {
    mode,
    skipPhases: OPTIONAL_PHASES.filter((phase) => !wanted.includes(phase)),
    topics: mode === "arya" ? [] : cleanTopics(topics),
  };
}

export function cleanTopics(topics: string[]): string[] {
  return topics.map((topic) => topic.replace(/\s+/g, " ").trim().slice(0, 120)).filter(Boolean).slice(0, 12);
}

/** Validates a plan that arrived over the network. Required parts can never be left out. */
export function readPlan(input: unknown): InterviewPlan | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;
  if (!MODES.includes(raw.mode as PlanMode)) return null;
  const skip = Array.isArray(raw.skipPhases) ? raw.skipPhases.filter((item): item is PhaseId => OPTIONAL_PHASES.includes(item as PhaseId)) : [];
  const topics = Array.isArray(raw.topics) ? cleanTopics(raw.topics.filter((item): item is string => typeof item === "string")) : [];
  return { mode: raw.mode as PlanMode, skipPhases: Array.from(new Set(skip)), topics };
}
