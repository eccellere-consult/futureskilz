import { z } from "zod";

import { labelOf, type QuestionDef } from "./question-bank";
import { metricMentions, namedTools, quoteAppearsIn, readSensitivity, sentencesOf, unsupportedNumbers } from "./signals";
import type { CareerRole, Confidence, FactCategory, FactKind, FollowUpKind, ReviewStatus, Segment, Sensitivity, SourceLink } from "./types";

/**
 * Turns source evidence (transcript segments) into proposed facts. Two readers share one contract:
 * - a rule-based reader that always works and keeps the expert's own words;
 * - an AI reader, used only when a provider is configured, whose every claim is checked against the evidence.
 *
 * The contract: a fact is accepted only if it points at a real segment and quotes it. A machine reading never becomes
 * "confirmed" on its own; the contributor does that in review.
 */

export type DraftFact = {
  category: FactCategory;
  kind: FactKind;
  title: string;
  statement: string;
  details?: Record<string, unknown> | null;
  roleId: string | null;
  processId: string | null;
  confidence: Confidence;
  reviewStatus: ReviewStatus;
  sensitivity: Sensitivity;
  sources: SourceLink[];
  machineExtracted: true;
};

export const FACT_CATEGORIES = [
  "career", "industry", "function", "process", "role", "kpi", "practice", "tool", "case", "skill", "tacit", "mistake", "leadership", "training", "permission",
] as const satisfies readonly FactCategory[];

const MAX_STATEMENT = 1500;
const MAX_QUOTE = 2000;

const clean = (text: string): string => text.replace(/\s+/g, " ").trim();

function quoteFrom(segment: Segment, sentence?: string): SourceLink {
  return { segmentId: segment.id, quote: (sentence ?? segment.text).trim().slice(0, MAX_QUOTE) };
}

export type RuleContext = {
  segment: Segment;
  question: QuestionDef | null;
  roleId: string | null;
  processId: string | null;
  processLabel?: string | null;
  depthOk: boolean;
};

/**
 * The rule-based reader. One fact for the answer itself (the expert's words, unaltered), plus small, clearly low-confidence
 * facts for a named tool or a measure, which the contributor is asked to complete in review.
 */
export function extractByRules(ctx: RuleContext): DraftFact[] {
  const { segment, question, roleId, processId } = ctx;
  if (segment.speaker !== "expert" || !segment.text.trim()) return [];
  const text = clean(segment.text);
  const sensitive = readSensitivity(text).possible ? "possible" : "none";
  const facts: DraftFact[] = [];

  if (question) {
    const category = question.produces[0];
    const details: Record<string, unknown> = { questionKey: question.key };
    if (ctx.processLabel) details.process = ctx.processLabel;
    if (question.expects.includes("steps") && category !== "case") {
      const steps = sentencesOf(text);
      if (steps.length > 1) details.steps = steps;
    }
    facts.push({
      category,
      kind: "direct_statement",
      title: ctx.processLabel && question.scope === "process" ? `${labelOf(question.key)}: ${ctx.processLabel}` : labelOf(question.key),
      statement: text.slice(0, MAX_STATEMENT),
      details,
      roleId,
      processId,
      confidence: ctx.depthOk ? "high" : "medium",
      reviewStatus: "proposed",
      sensitivity: sensitive,
      sources: [quoteFrom(segment)],
      machineExtracted: true,
    });
  }

  for (const tool of namedTools(text).slice(0, 4)) {
    const sentence = sentencesOf(text).find((candidate) => candidate.includes(tool)) ?? text.slice(0, 240);
    facts.push({
      category: "tool",
      kind: "direct_statement",
      title: `Tool or method mentioned: ${tool}`,
      statement: `The contributor mentions ${tool}. How it was used is not yet described.`,
      details: { tool, usage: null },
      roleId,
      processId,
      confidence: "low",
      reviewStatus: "needs_confirmation",
      sensitivity: "none",
      sources: [quoteFrom(segment, sentence)],
      machineExtracted: true,
    });
  }

  for (const metric of metricMentions(text).slice(0, 2)) {
    facts.push({
      category: "kpi",
      kind: "direct_statement",
      title: "Measure mentioned",
      statement: metric.phrase,
      details: { definition: null, baseline: null, target: null, period: null, result: null },
      roleId,
      processId,
      confidence: "low",
      reviewStatus: "needs_confirmation",
      sensitivity: "none",
      sources: [quoteFrom(segment, sentencesOf(text).find((candidate) => candidate.startsWith(metric.phrase.slice(0, 30))) ?? metric.phrase)],
      machineExtracted: true,
    });
  }
  return facts;
}

const FOLLOW_UP_CATEGORY: Partial<Record<FollowUpKind, { category: FactCategory; title: string }>> = {
  example: { category: "case", title: "Example" },
  steps: { category: "practice", title: "Steps in order" },
  outcome: { category: "case", title: "Result" },
  number: { category: "kpi", title: "Figures recalled" },
  tool: { category: "tool", title: "Tool or template" },
  date: { category: "career", title: "Dates" },
  metric: { category: "kpi", title: "How the measure was defined" },
  tool_use: { category: "tool", title: "How the tool was used" },
};

/** A follow-up answer becomes a fact that completes the one it came from. */
export function extractFollowUp(kind: FollowUpKind, segment: Segment, roleId: string | null, processId: string | null, parentFactTitle?: string): DraftFact[] {
  const spec = FOLLOW_UP_CATEGORY[kind];
  if (!spec || segment.speaker !== "expert" || !segment.text.trim()) return [];
  const text = clean(segment.text);
  return [
    {
      category: spec.category,
      kind: "direct_statement",
      title: parentFactTitle ? `${spec.title} (${parentFactTitle})` : spec.title,
      statement: text.slice(0, MAX_STATEMENT),
      details: { followUp: kind },
      roleId,
      processId,
      confidence: "medium",
      reviewStatus: "proposed",
      sensitivity: readSensitivity(text).possible ? "possible" : "none",
      sources: [quoteFrom(segment)],
      machineExtracted: true,
    },
  ];
}

/** A career fact for a confirmed job, sourced to the walk-through that named it. */
export function careerFactFromRole(role: CareerRole, segment: Segment, quote?: string): DraftFact {
  const years = `${role.datesApproximate ? "about " : ""}${role.startYear ?? "?"} to ${role.ongoing ? "the present" : (role.endYear ?? "?")}`;
  return {
    category: "career",
    kind: "direct_statement",
    title: `${role.title || "Role"} at ${role.company || "an employer"}`,
    statement: `${role.title || "Role not named"} at ${role.company || "employer not named"}, ${years}.`,
    details: { roleId: role.id, industry: role.industry, location: role.location },
    roleId: role.id,
    processId: null,
    confidence: role.confirmed ? "high" : "medium",
    reviewStatus: role.confirmed ? "confirmed" : "proposed",
    sensitivity: "none",
    sources: [quoteFrom(segment, quote)],
    machineExtracted: true,
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// The AI reader and its validator
// ---------------------------------------------------------------------------------------------------------------------

const aiFactSchema = z.object({
  category: z.enum(FACT_CATEGORIES),
  kind: z.enum(["direct_statement", "ai_synthesis"]).default("direct_statement"),
  title: z.string().min(3).max(140),
  statement: z.string().min(5).max(MAX_STATEMENT),
  segmentId: z.string().min(1),
  quote: z.string().min(3).max(MAX_QUOTE),
  confidence: z.enum(["high", "medium", "low"]).default("medium"),
  details: z.record(z.string(), z.unknown()).optional(),
});

export const aiExtractionSchema = z.object({ facts: z.array(aiFactSchema).max(12) });

export type Rejection = { reason: "schema" | "unknown_segment" | "quote_not_found" | "unsupported_number" | "speaker"; detail: string };

export type ValidatedExtraction = { accepted: DraftFact[]; rejected: Rejection[] };

/** Models sometimes wrap JSON in code fences or add a sentence before it. */
export function parseJsonLoose(content: string): unknown {
  const trimmed = content.trim();
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);
  const body = fenced ? fenced[1] : trimmed;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("No JSON object found.");
  return JSON.parse(body.slice(start, end + 1));
}

export function validateAiFacts(raw: unknown, segments: Segment[], context: { roleId: string | null; processId: string | null }): ValidatedExtraction {
  const accepted: DraftFact[] = [];
  const rejected: Rejection[] = [];
  const container = aiExtractionSchema.safeParse(raw);
  const items: unknown[] = container.success ? container.data.facts : Array.isArray((raw as { facts?: unknown[] } | null)?.facts) ? (raw as { facts: unknown[] }).facts : [];
  if (!container.success && items.length === 0) return { accepted, rejected: [{ reason: "schema", detail: container.error.issues[0]?.message ?? "invalid" }] };
  const byId = new Map(segments.map((segment) => [segment.id, segment]));

  for (const item of items) {
    const parsed = aiFactSchema.safeParse(item);
    if (!parsed.success) {
      rejected.push({ reason: "schema", detail: parsed.error.issues[0]?.message ?? "invalid" });
      continue;
    }
    const fact = parsed.data;
    const segment = byId.get(fact.segmentId);
    if (!segment) {
      rejected.push({ reason: "unknown_segment", detail: fact.segmentId });
      continue;
    }
    if (segment.speaker !== "expert") {
      rejected.push({ reason: "speaker", detail: "The companion's own words are not evidence." });
      continue;
    }
    if (!quoteAppearsIn(fact.quote, segment.text)) {
      rejected.push({ reason: "quote_not_found", detail: fact.quote.slice(0, 80) });
      continue;
    }
    const invented = unsupportedNumbers(fact.statement, fact.quote);
    if (invented.length > 0) {
      rejected.push({ reason: "unsupported_number", detail: invented.join(", ") });
      continue;
    }
    const synthesis = fact.kind === "ai_synthesis";
    const kind: FactKind = segment.source === "upload" && !synthesis ? "source_fact" : fact.kind;
    accepted.push({
      category: fact.category,
      kind,
      title: fact.title,
      statement: fact.statement,
      details: fact.details ?? null,
      roleId: segment.roleId ?? context.roleId,
      processId: context.processId,
      confidence: synthesis ? "low" : fact.confidence,
      reviewStatus: synthesis ? "needs_confirmation" : "proposed",
      sensitivity: readSensitivity(`${fact.statement} ${fact.quote}`).possible ? "possible" : "none",
      sources: [quoteFrom(segment, fact.quote)],
      machineExtracted: true,
    });
  }
  return { accepted, rejected };
}

export function buildExtractionMessages(input: { segments: Segment[]; question: string | null; categories: FactCategory[] }): Array<{ role: "system" | "user"; content: string }> {
  const system = [
    "You read an interview with an experienced professional and list the facts that someone could teach from.",
    "Strict rules:",
    "1. Use ONLY what the expert says in the segments below. Never add companies, dates, numbers, tools, names or outcomes that are not stated.",
    "2. Every fact needs a segmentId and a quote copied exactly from that segment.",
    "3. Do not copy numbers into a statement unless the same number is in the quote.",
    '4. kind is "direct_statement" when you restate what the expert said, "ai_synthesis" only when you combine or interpret.',
    `5. category is one of: ${FACT_CATEGORIES.join(", ")}.`,
    "6. Prefer fewer, richer facts. At most 8. Skip small talk.",
    'Reply with JSON only: {"facts":[{"category":"","kind":"","title":"","statement":"","segmentId":"","quote":"","confidence":"high|medium|low"}]}',
  ].join("\n");
  const evidence = input.segments.map((segment) => `[segmentId=${segment.id}]\n${segment.text}`).join("\n\n");
  return [
    { role: "system", content: system },
    {
      role: "user",
      content: `${input.question ? `Question asked: ${input.question}\n` : ""}Likely categories: ${input.categories.join(", ") || "any"}\n\nSEGMENTS:\n${evidence}`.slice(0, 12000),
    },
  ];
}
