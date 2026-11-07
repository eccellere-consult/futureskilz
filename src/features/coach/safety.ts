/**
 * Safety rules for Arya as a coach. Plain, testable code that runs before a message reaches a model and after a reply comes back,
 * so the guarantees do not depend on how well a model behaves.
 *
 *  - A message about harming oneself or others is never answered by a model: Arya says she is an AI and points to a person.
 *  - A message that tries to change Arya's rules is not passed on; she steers back to the lesson.
 *  - Personal details are removed before a message is sent or saved.
 *  - A reply that claims to be human, reveals instructions, or carries a link that is not in the lesson is replaced.
 */
export type Screen =
  | { action: "allow"; text: string; redacted: boolean }
  | { action: "crisis" }
  | { action: "refuse"; reason: "empty" | "injection" };

export const MAX_MESSAGE_CHARS = 600;
export const MAX_REPLY_CHARS = 900;

const CRISIS = /\b(suicid\w*|kill (myself|me)|end (my|it all)|self[- ]?harm|hurt(ing)? myself|want to die|don'?t want to (live|be here)|no reason to live|(abus(ed|ing)|assault(ed|ing)|threaten(ed|ing)) (me|us)|(being|been) (abused|assaulted|threatened)|(someone|he|she|they) (is|are|will) (hurt|kill)\w*)\b/i;
const INJECTION = /(ignore|disregard|forget) (all |any |the |your |previous |prior |above )*(previous |prior |above )?(instructions|rules|prompt)|(reveal|show|print|repeat) (me )?(your|the) (system )?(prompt|instructions)|\byou are now\b|\bpretend (to be|you are)\b|\bdeveloper mode\b|\bjailbreak\b|\bDAN mode\b/i;

const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
// Ten-digit mobile numbers (with an optional +91 or 0), twelve-digit Aadhaar-style numbers, and PAN-style codes.
const PHONE = /(?:\+?91[\s-]?|0)?[6-9]\d{4}[\s-]?\d{5}\b/g;
const AADHAAR = /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g;
const PAN = /\b[A-Z]{5}\d{4}[A-Z]\b/g;

export function redact(text: string): { text: string; redacted: boolean } {
  const out = text.replace(EMAIL, "[removed]").replace(PAN, "[removed]").replace(AADHAAR, "[removed]").replace(PHONE, "[removed]");
  return { text: out, redacted: out !== text };
}

/** For long text, such as a practice note, where the whole of it must be checked and not only the first part. */
export const isCrisis = (text: string): boolean => CRISIS.test(text);

export function screenInput(raw: string): Screen {
  const trimmed = raw.replace(/\s+/g, " ").trim().slice(0, MAX_MESSAGE_CHARS);
  if (trimmed.length < 2) return { action: "refuse", reason: "empty" };
  if (CRISIS.test(trimmed)) return { action: "crisis" };
  if (INJECTION.test(trimmed)) return { action: "refuse", reason: "injection" };
  const { text, redacted } = redact(trimmed);
  return { action: "allow", text, redacted };
}

export const CRISIS_REPLY =
  "I am an AI, and I am not the right help for this. What you wrote matters. Please talk to someone now: a person you trust, a doctor, or your local emergency number or a helpline in your area. If you are in danger, call emergency services. When you are ready, the Skill Shot will be here.";
export const INJECTION_REPLY = "I can only help with this Skill Shot: the idea, the steps, an example, a hint for the decision, or your work task. What would help?";
export const EMPTY_REPLY = "Ask me about the idea, the steps, an example, or the decision, and I will help.";
export const REDACTED_NOTE = " (I removed personal details from your message. Please do not share them here.)";

const HUMAN_CLAIM = /\b(i am|i'm|i’m) (a )?(real )?(human|person|woman|girl|teacher at)\b|\bas a human\b|\bmy (system )?(prompt|instructions) (is|are|says?)\b|\bsystem prompt\b/i;
const URL = /\b(?:https?:\/\/|www\.)[^\s)]+/gi;
const MARKDOWN_LINK = /\[([^\]]+)\]\((?:https?:\/\/)?[^)]+\)/g;

/** Returns the reply to show, or null when it must be replaced by the caller's fallback. */
export function cleanReply(raw: string, allowed: { urls?: string[] } = {}): string | null {
  let text = raw.replace(/\s+\n/g, "\n").trim();
  if (!text || HUMAN_CLAIM.test(text)) return null;
  const allowedUrls = new Set((allowed.urls ?? []).map((url) => url.toLowerCase()));
  text = text.replace(MARKDOWN_LINK, "$1").replace(URL, (url) => (allowedUrls.has(url.toLowerCase()) ? url : "")).replace(/[ \t]{2,}/g, " ").trim();
  if (!text) return null;
  if (text.length > MAX_REPLY_CHARS) {
    const cut = text.slice(0, MAX_REPLY_CHARS);
    const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("? "), cut.lastIndexOf("! "));
    text = end > 200 ? cut.slice(0, end + 1) : `${cut.trimEnd()}…`;
  }
  return text;
}
