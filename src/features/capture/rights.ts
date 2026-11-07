/**
 * Rights and safety checks for lessons made from a source (a document, pasted text, a link's text).
 * Both are HEURISTICS, not legal clearance: they reduce risk and show a person the passage, they never decide a
 * copyright or safety question. A hit blocks approval until the lesson is rewritten.
 */

/** The statement a contributor ticks before a source is read. Bump the version when the wording changes. */
export const ATTESTATION_VERSION = "2026-11-v1";
export const ATTESTATION_TEXT = "I own this material or have permission to use it for teaching. I understand lessons made from it must be in my own words, and that I am responsible for what I add.";

export type OverlapHit = { passage: string; words: number };
export type OverlapResult = { ratio: number; longestRun: number; hits: OverlapHit[]; draftWords: number };

const SHINGLE = 8;
/** A copied run of this many words, or this share of a draft of at least MIN_DRAFT_WORDS, is blocked. */
export const COPIED_RUN_BLOCK = 15;
export const COPIED_SHARE_BLOCK = 0.2;
export const MIN_DRAFT_WORDS = 30;

const words = (text: string): string[] => text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);

/** Compares a draft with protected source texts using word 8-gram shingles. */
export function verbatimOverlap(draft: string, sources: string[]): OverlapResult {
  const draftWords = words(draft);
  if (draftWords.length < SHINGLE) return { ratio: 0, longestRun: 0, hits: [], draftWords: draftWords.length };
  const known = new Set<string>();
  for (const source of sources) {
    const w = words(source);
    for (let i = 0; i + SHINGLE <= w.length; i++) known.add(w.slice(i, i + SHINGLE).join(" "));
  }
  const covered = new Array<boolean>(draftWords.length).fill(false);
  for (let i = 0; i + SHINGLE <= draftWords.length; i++) {
    if (known.has(draftWords.slice(i, i + SHINGLE).join(" "))) for (let j = i; j < i + SHINGLE; j++) covered[j] = true;
  }
  const hits: OverlapHit[] = [];
  let longestRun = 0;
  for (let i = 0; i < covered.length; ) {
    if (!covered[i]) { i++; continue; }
    let j = i;
    while (j < covered.length && covered[j]) j++;
    const run = j - i;
    longestRun = Math.max(longestRun, run);
    hits.push({ passage: draftWords.slice(i, j).join(" "), words: run });
    i = j;
  }
  const coveredCount = covered.filter(Boolean).length;
  return { ratio: coveredCount / draftWords.length, longestRun, hits: hits.sort((a, b) => b.words - a.words).slice(0, 3), draftWords: draftWords.length };
}

export function isTooCopied(result: OverlapResult): boolean {
  return result.longestRun >= COPIED_RUN_BLOCK || (result.draftWords >= MIN_DRAFT_WORDS && result.ratio >= COPIED_SHARE_BLOCK);
}

const SAFETY_RULES: Array<{ id: string; pattern: RegExp; message: string }> = [
  { id: "medical_dose", pattern: /\b(take|dose|dosage|administer|inject)\b[^.]{0,40}\b\d+\s?(mg|mcg|ml|iu|tablets?|pills?)\b/i, message: "gives a medical dose" },
  { id: "self_harm", pattern: /\b(kill yourself|end your life|self[- ]harm|commit suicide)\b/i, message: "touches self-harm" },
  { id: "guaranteed_returns", pattern: /\b(guaranteed|assured|risk[- ]free)\b[^.]{0,30}\b(returns?|profit|income)\b/i, message: "promises guaranteed financial returns" },
  { id: "tax_evasion", pattern: /\b(evade|avoid paying|hide income from)\b[^.]{0,30}\b(tax|gst|duty)\b/i, message: "advises evading tax" },
  { id: "bypass_safety", pattern: /\b(bypass|disable|override|remove)\b[^.]{0,30}\b(interlock|safety guard|safety switch|lockout|e-?stop|emergency stop)\b/i, message: "advises bypassing a safety device" },
  { id: "no_ppe", pattern: /\b(skip|without|no need for|don'?t (?:wear|use))\b[^.]{0,20}\b(ppe|helmet|gloves|goggles|safety harness|respirator)\b/i, message: "advises working without protective equipment" },
  { id: "forgery", pattern: /\b(forge|fake|backdate|falsify)\b[^.]{0,30}\b(document|signature|certificate|invoice|record|report)\b/i, message: "advises falsifying a document" },
];

export type SafetyHit = { id: string; message: string; excerpt: string };

/** A small rule list for clearly harmful advice. Not a substitute for an editor reading the lesson. */
export function screenHarmfulAdvice(text: string): SafetyHit[] {
  const hits: SafetyHit[] = [];
  for (const rule of SAFETY_RULES) {
    const match = rule.pattern.exec(text);
    if (match) hits.push({ id: rule.id, message: rule.message, excerpt: text.slice(Math.max(0, match.index - 20), match.index + match[0].length + 20).replace(/\s+/g, " ").trim() });
  }
  return hits;
}
