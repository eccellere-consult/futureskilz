import type { Blueprint } from "../skillshot/types";
import { tokens } from "./context";

/**
 * Feedback on a learner's practice note, against the Skill Shot's own success criteria. It is feedback, not a grade: it says what
 * the note shows, quotes the words it relied on, and suggests one next step for each criterion. It does not change skill levels.
 */
export type CriterionStatus = "met" | "partly" | "not-yet";
export type CriterionFeedback = { criterion: string; status: CriterionStatus; evidence: string; next: string };
export type PracticeFeedback = { overall: string; criteria: CriterionFeedback[]; nextStep: string; source: "ai" | "rules" };

export const MIN_NOTE_WORDS = 12;
export const MAX_NOTE_CHARS = 2000;

/** Verbs that open almost every criterion ("Writes…", "Gives…"). They say what the learner does, not what the note must be about. */
const CRITERION_VERBS = new Set("writes gives stops proposes makes uses shows names lists states identifies explains describes chooses checks sets picks takes adds".split(" "));

const sentences = (text: string): string[] => text.match(/[^.!?\n]+[.!?]?/g)?.map((part) => part.trim()).filter(Boolean) ?? [];
const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);
const norm = (text: string) => text.toLowerCase().replace(/\s+/g, " ").trim();

export const wordCount = (text: string): number => (text.trim() ? text.trim().split(/\s+/).length : 0);

/** Plain (no-AI) review: does the note use the criterion's own key words, and where? Coarser than the AI review, and labelled so. */
export function reviewPracticeByRules(blueprint: Pick<Blueprint, "design">, rawNote: string): PracticeFeedback {
  const note = rawNote.replace(/\s+/g, " ").trim().slice(0, MAX_NOTE_CHARS);
  const criteria = blueprint.design.successCriteria;
  if (wordCount(note) < MIN_NOTE_WORDS) {
    return {
      overall: `Your note is very short, so I cannot tell much from it yet. Write a few sentences about a real problem from your work and how you would use this.`,
      criteria: criteria.map((criterion) => ({ criterion, status: "not-yet", evidence: "", next: `Add the part about: ${criterion}` })),
      nextStep: "Write three or four sentences about one real situation, then ask me again.",
      source: "rules",
    };
  }
  const noteWords = new Set(tokens(note));
  const parts = sentences(note);
  const result: CriterionFeedback[] = criteria.map((criterion) => {
    const keys = [...new Set(tokens(criterion))].filter((word) => word.length >= 5 && !CRITERION_VERBS.has(word)).slice(0, 6);
    const hits = keys.filter((word) => noteWords.has(word) || [...noteWords].some((candidate) => candidate.startsWith(word.slice(0, 5)) && word.length >= 6));
    const status: CriterionStatus = hits.length >= 2 && hits.length / Math.max(keys.length, 1) >= 0.34 ? "met" : hits.length >= 1 ? "partly" : "not-yet";
    const evidence = hits.length ? clip(parts.find((part) => hits.some((word) => norm(part).includes(word.slice(0, 5)))) ?? "", 160) : "";
    const next = status === "met" ? "Make it firmer: say how you checked it, or what result you expect." : status === "partly" ? `Say more about: ${criterion}` : `Add the part about: ${criterion}`;
    return { criterion, status, evidence, next };
  });
  const met = result.filter((item) => item.status === "met").length;
  const specific = /\d|last (week|month|time)|yesterday|today|monday|tuesday|wednesday|thursday|friday/i.test(note);
  const gap = result.find((item) => item.status !== "met");
  return {
    overall: `${met} of ${result.length} criteria look clear in your note. ${specific ? "You used a specific situation, which makes it easier to check." : "Adding a specific situation, such as what happened last week, would make it easier to check."} This is an automatic reading by keywords, so treat it as a prompt to reread your own note.`,
    criteria: result,
    nextStep: gap ? gap.next : "Share this with your team lead, as the task suggests, and ask what they would change.",
    source: "rules",
  };
}

const STATUSES: CriterionStatus[] = ["met", "partly", "not-yet"];

/**
 * Checks a model's feedback before it is shown. Criteria must be the lesson's own, in order; a quote must really be in the note
 * (otherwise it is dropped, not shown), so feedback cannot cite words the learner never wrote. Returns null if it is unusable.
 */
export function validateAiFeedback(raw: unknown, blueprint: Pick<Blueprint, "design">, note: string): PracticeFeedback | null {
  let value = raw;
  if (typeof raw === "string") {
    const text = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    try {
      value = JSON.parse(text.slice(start, end + 1));
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== "object") return null;
  const data = value as { overall?: unknown; criteria?: unknown; nextStep?: unknown };
  const expected = blueprint.design.successCriteria;
  if (!Array.isArray(data.criteria) || data.criteria.length !== expected.length || typeof data.overall !== "string" || typeof data.nextStep !== "string") return null;
  const haystack = norm(note);
  const criteria: CriterionFeedback[] = [];
  for (let i = 0; i < expected.length; i += 1) {
    const item = data.criteria[i] as { status?: unknown; evidence?: unknown; next?: unknown } | null;
    if (!item || !STATUSES.includes(item.status as CriterionStatus) || typeof item.next !== "string") return null;
    const quote = typeof item.evidence === "string" ? item.evidence.trim() : "";
    const real = quote.length >= 4 && haystack.includes(norm(quote).replace(/^…|…$/g, ""));
    criteria.push({ criterion: expected[i], status: item.status as CriterionStatus, evidence: real ? clip(quote, 160) : "", next: clip(item.next, 220) });
  }
  // "Met" with nothing quoted is a claim that cannot be checked, so it is shown as "partly".
  for (const item of criteria) if (item.status === "met" && !item.evidence) item.status = "partly";
  return { overall: clip(data.overall, 420), criteria, nextStep: clip(data.nextStep, 240), source: "ai" };
}
