import type { Expectation } from "./types";

/**
 * Plain, inspectable rules that read an answer. They are heuristics, not measurement: a "specificity" score of 0.7 means
 * the answer carried most of the signals a concrete answer usually carries, nothing more. They exist to decide what to ask
 * next, never to grade the expert.
 */

export type AnswerSignals = {
  words: number;
  hasExample: boolean;
  hasSteps: boolean;
  hasNumber: boolean;
  hasTool: boolean;
  hasOutcome: boolean;
  hasDate: boolean;
};

const KNOWN_TOOLS = [
  "SAP", "Oracle", "Excel", "Power BI", "Tableau", "Salesforce", "ERP", "MES", "SCADA", "WMS", "TMS", "CRM", "SQL", "Python",
  "Jira", "Kaizen", "Lean", "Six Sigma", "5S", "TPM", "FMEA", "SPC", "OEE", "Kanban", "Gemba", "PowerPoint", "Access", "Tally",
  "AutoCAD", "SolidWorks", "ANSYS", "MATLAB", "Primavera", "MS Project", "SharePoint", "Workday", "Peoplesoft", "Ariba",
  "Coupa", "QuickBooks", "Hyperion", "Minitab", "Visio", "Slack", "Teams", "ServiceNow", "Zendesk", "HubSpot", "Looker",
];

const EXAMPLE_CUES = /\b(for example|for instance|e\.g\.|one time|once|i remember|there was|we had a|when we|that time|a case where|in one case|on one occasion|a project where|the day)\b/i;
const STEP_CUES = /\b(first(ly)?|second(ly)?|third(ly)?|then|next|after that|afterwards|finally|step \d|step one|step two|1\)|2\)|1\.|2\.)\b/i;
const OUTCOME_CUES = /\b(result(ed|s)?|reduc(e|ed|ing)|increas(e|ed|ing)|improv(e|ed|ing)|sav(e|ed|ing)|led to|so that|achiev(e|ed)|delivered|cut|grew|dropped|halved|doubled|outcome|ended up|worked out|turned around)\b/i;
const NUMBER = /(\d[\d,.]*\s?(%|percent|per cent|lakh|crore|million|billion|k\b|days?|weeks?|months?|hours?|units?|tonnes?|tons?|people|members))|(\b\d{2,}\b)/i;
const YEAR = /\b(19[5-9]\d|20[0-4]\d)\b/;

export function readSignals(text: string): AnswerSignals {
  const trimmed = text.trim();
  return {
    words: trimmed ? trimmed.split(/\s+/).length : 0,
    hasExample: EXAMPLE_CUES.test(trimmed),
    hasSteps: STEP_CUES.test(trimmed),
    hasNumber: NUMBER.test(trimmed),
    hasTool: namedTools(trimmed).length > 0,
    hasOutcome: OUTCOME_CUES.test(trimmed),
    hasDate: YEAR.test(trimmed),
  };
}

const HAS: Record<Expectation, keyof AnswerSignals> = {
  example: "hasExample",
  steps: "hasSteps",
  number: "hasNumber",
  tool: "hasTool",
  outcome: "hasOutcome",
  date: "hasDate",
};

export function missingExpectations(signals: AnswerSignals, expects: Expectation[]): Expectation[] {
  return expects.filter((expectation) => !signals[HAS[expectation]]);
}

/** 0 for a thin answer, 1 for one that is long enough and carries every signal the question looks for. */
export function specificity(signals: AnswerSignals, expects: Expectation[], minWords: number): number {
  const lengthScore = Math.min(1, signals.words / Math.max(1, minWords));
  if (expects.length === 0) return lengthScore;
  const present = expects.length - missingExpectations(signals, expects).length;
  return Number((0.4 * lengthScore + 0.6 * (present / expects.length)).toFixed(2));
}

const UNKNOWN_PHRASES = /^(i\s*(do not|don't|dont)\s*(remember|recall|know)|not sure|no idea|can't recall|cannot recall|i'?m not sure|skip|pass|next question|no comment)\b/i;

export function sounds(text: string): "unknown" | "answer" {
  return UNKNOWN_PHRASES.test(text.trim()) ? "unknown" : "answer";
}

/** Tools and methods the answer names: known ones, plus a capitalised word right after "using / in / on / with". */
export function namedTools(text: string): string[] {
  const found = new Set<string>();
  for (const tool of KNOWN_TOOLS) {
    const escaped = tool.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`(^|[^A-Za-z0-9])${escaped}([^A-Za-z0-9]|$)`).test(text)) found.add(tool);
  }
  for (const match of text.matchAll(/\b(?:using|used|via|through)\s+(?:a\s+|an\s+|the\s+|our\s+)?([A-Z][A-Za-z0-9+#]{2,}(?:\s[A-Z][A-Za-z0-9+#]{2,})?)/g)) {
    const candidate = match[1];
    if (!COMMON_CAPS.has(candidate.toLowerCase())) found.add(candidate);
  }
  return [...found].slice(0, 6);
}

const COMMON_CAPS = new Set([
  "the", "this", "that", "india", "when", "then", "from", "our", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday",
  "sunday", "january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december",
  "mumbai", "delhi", "pune", "chennai", "bangalore", "bengaluru", "hyderabad", "kolkata", "gurgaon", "noida", "europe", "asia",
]);

export type MetricMention = { phrase: string };

/** Numbers that read like a measured result ("cut downtime by 18%", "OEE of 72"), so the companion can ask how it was defined. */
export function metricMentions(text: string): MetricMention[] {
  const out: MetricMention[] = [];
  const sentences = text.split(/(?<=[.!?\n])\s+/);
  for (const sentence of sentences) {
    if (!NUMBER.test(sentence)) continue;
    if (!/(%|percent|per cent|kpi|target|rate|ratio|score|index|cost|revenue|margin|downtime|yield|defect|turnover|attrition|cycle time|lead time|on[- ]time|utili[sz]ation|productivity|oee|nps|sla|saving|budget|growth|reduc|increas|improv)/i.test(sentence)) continue;
    const phrase = sentence.trim().replace(/\s+/g, " ").slice(0, 140);
    out.push({ phrase });
  }
  return out.slice(0, 3);
}

const SENSITIVE_CUES = /\b(confidential|nda|non[- ]disclosure|proprietary|trade secret|internal only|lawsuit|litigation|fired|terminated|harass\w*|bribe\w*|kickback|salary|salaries|compensation|medical|illness|diagnos\w*|union dispute|whistle\w*)\b/i;
const TITLE_NAME = /\b(?:Mr|Mrs|Ms|Dr|Prof|Shri|Smt)\.?\s+[A-Z][a-z]+/;
const RELATION_NAME = /\b(?:my|our)\s+(?:boss|manager|supervisor|director|CEO|colleague|mentor|team lead|head)\s+(?:was\s+|is\s+|named\s+|called\s+)?([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)/;

export type SensitivityReading = { possible: boolean; reasons: string[] };

export function readSensitivity(text: string): SensitivityReading {
  const reasons: string[] = [];
  const cue = SENSITIVE_CUES.exec(text);
  if (cue) reasons.push(`mentions "${cue[0].toLowerCase()}"`);
  if (TITLE_NAME.test(text) || RELATION_NAME.test(text)) reasons.push("names a colleague");
  return { possible: reasons.length > 0, reasons };
}

export type YearSpan = { start: number; end: number | null; ongoing: boolean; approximate: boolean; index: number; raw: string };

const SPAN =
  /\b(?:(?:around|about|circa|c\.|approx(?:imately)?\.?|roughly|in)\s+)?((?:19[5-9]|20[0-4])\d)\s*(?:-|–|—|to|until|till|through)\s*((?:19[5-9]|20[0-4])\d|\d{2}(?![\d])|present|now|date|today|retire\w*|current)/gi;

/** Year ranges such as "1998-2004", "2004 to present", "2005–09". */
export function yearSpans(text: string): YearSpan[] {
  const spans: YearSpan[] = [];
  for (const match of text.matchAll(SPAN)) {
    const start = Number(match[1]);
    const rawEnd = match[2].toLowerCase();
    const ongoing = /^(present|now|date|today|current)/.test(rawEnd);
    const retired = rawEnd.startsWith("retire");
    let end: number | null = null;
    if (/^\d{4}$/.test(rawEnd)) end = Number(rawEnd);
    else if (/^\d{2}$/.test(rawEnd)) end = Math.floor(start / 100) * 100 + Number(rawEnd);
    if (end !== null && end < start) end = null;
    const approximate = /\b(around|about|circa|c\.|approx|roughly)/i.test(match[0]) || retired;
    spans.push({ start, end, ongoing, approximate, index: match.index ?? 0, raw: match[0] });
  }
  return spans;
}

/** Splits a quote into sentences without breaking decimals or abbreviations like "Mr." too aggressively. */
export function sentencesOf(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"'(])/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

/** Lower-cases and collapses punctuation and spacing so a quote can be matched against the text it came from. */
export function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^a-z0-9%.\s']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function quoteAppearsIn(quote: string, source: string): boolean {
  const q = normalizeForMatch(quote);
  return q.length >= 3 && normalizeForMatch(source).includes(q);
}

/** The numbers in a statement that do not occur in the quote that supposedly supports it: a sign of an invented figure. */
export function unsupportedNumbers(statement: string, quote: string): string[] {
  const inQuote = new Set((quote.match(/\d[\d,.]*/g) ?? []).map(canonicalNumber));
  return (statement.match(/\d[\d,.]*/g) ?? []).map(canonicalNumber).filter((n) => n && !inQuote.has(n));
}

function canonicalNumber(value: string): string {
  return value.replace(/[,.]+$/, "").replace(/,/g, "");
}
