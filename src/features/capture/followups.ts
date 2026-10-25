import type { OpenQuestion } from "./planner";
import type { Timeline } from "./timeline";
import type { Fact } from "./types";

/**
 * `follow_up_questions.md`: a prioritised list of what would close the gaps. It never asks again for something already
 * known from another source; for those it asks only for confirmation and names where the answer came from.
 */

export type FollowUp = { priority: number; question: string; reason: string; kind: "confirm" | "ask" | "decide" | "fix" };

export function buildFollowUps(input: { open: OpenQuestion[]; facts: Fact[]; timeline: Timeline }): FollowUp[] {
  const out: FollowUp[] = [];
  const live = input.facts.filter((fact) => fact.reviewStatus !== "rejected");

  for (const flag of input.timeline.flags.filter((f) => f.severity === "conflict" || f.severity === "overlap" || f.severity === "gap" || f.severity === "vague")) {
    out.push({ priority: flag.severity === "conflict" ? 10 : 8, question: flag.message, reason: "Timeline check", kind: "fix" });
  }
  for (const fact of live.filter((item) => item.sensitivity !== "none" && item.permission === "unset")) {
    out.push({ priority: 9, question: `May "${fact.title}" be shared, shared anonymised, or kept private?`, reason: "Possibly sensitive; needs your choice before publication", kind: "decide" });
  }
  for (const fact of live.filter((item) => item.category === "kpi" && item.details && ("definition" in item.details) && item.details.definition == null)) {
    out.push({ priority: 7, question: `How was this measure defined, and what were its baseline, target, period and result? "${fact.statement.slice(0, 120)}"`, reason: "Measure mentioned without a definition. No targets are inferred.", kind: "ask" });
  }
  for (const fact of live.filter((item) => item.category === "tool" && item.details && "usage" in item.details && item.details.usage == null)) {
    out.push({ priority: 6, question: `How did you use ${String(fact.details?.tool ?? "this tool")}, who else used it, and what did it produce?`, reason: "Tool named but not described", kind: "ask" });
  }
  const unconfirmed = live.filter((item) => item.reviewStatus === "needs_confirmation" && item.category !== "kpi" && item.category !== "tool");
  for (const fact of unconfirmed.slice(0, 10)) out.push({ priority: 5, question: `Please confirm: ${fact.statement.slice(0, 160)}`, reason: fact.kind === "ai_synthesis" ? "AI synthesis, needs your confirmation" : "Needs your confirmation", kind: "confirm" });
  for (const question of input.open) out.push({ priority: Math.min(7, question.priority - 1), question: question.text, reason: question.reason, kind: "ask" });
  return out.sort((a, b) => b.priority - a.priority);
}

export function renderFollowUps(items: FollowUp[], generatedAt: string): string {
  const lines = ["# Follow-up questions", "", `Prepared ${generatedAt}. Highest priority first.`, ""];
  if (items.length === 0) lines.push("Nothing outstanding.");
  items.forEach((item, index) => lines.push(`${index + 1}. **${item.question}**  `, `   _${item.kind}: ${item.reason}_`));
  lines.push("");
  return lines.join("\n");
}

export function renderSourceMapCsv(rows: Array<{ ref: string; origin: string; locator?: string | null; quote: string; facts: string[] }>): string {
  const cell = (value: string): string => `"${value.replace(/"/g, '""').replace(/\s+/g, " ")}"`;
  return ["ref,origin,locator,quote,statements", ...rows.map((row) => [row.ref, row.origin, row.locator ?? "", row.quote.slice(0, 400), row.facts.join("; ")].map(cell).join(","))].join("\n");
}
