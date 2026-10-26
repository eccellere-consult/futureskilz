import type { Blueprint } from "./types";

/** The server grades the knowledge check itself, so a browser can never award its own evidence. */
export type CheckResult = { correct: number; total: number; passed: boolean };

export function gradeKnowledgeCheck(blueprint: Pick<Blueprint, "knowledgeCheck">, answers: Record<string, string>): CheckResult {
  const total = blueprint.knowledgeCheck.length;
  const correct = blueprint.knowledgeCheck.filter((question) => answers[question.id] === question.correctId).length;
  const answeredAll = blueprint.knowledgeCheck.every((question) => typeof answers[question.id] === "string");
  // Two of three, or the same share of a longer check. Finishing shows understanding, not mastery, so the gain stays small.
  return { correct, total, passed: answeredAll && total > 0 && correct >= Math.ceil((total * 2) / 3) };
}
