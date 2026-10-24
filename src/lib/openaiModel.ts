/**
 * openaiModel.ts — the chat model used across every AI engine, in one place.
 *
 * Migrated from gpt-4o to gpt-5: cheaper per-token ($1.25 vs $2.50 per 1M
 * input tokens, same $10 per 1M output) and far higher rate-limit headroom
 * on this account (500,000 TPM vs gpt-4o's 30,000 TPM — OpenAI tracks
 * limits separately per model).
 *
 * GPT-5 is a reasoning model with three differences from gpt-4o at the
 * chat.completions.create() call site, confirmed by live testing against
 * the real API (the docs were inconsistent on whether this even worked
 * without migrating to the separate Responses API — it does, with these
 * three adjustments):
 *
 *   1. `max_tokens` is rejected outright — use `max_completion_tokens`.
 *   2. `temperature` other than the default (1) is rejected — omit it
 *      entirely rather than pass any specific value.
 *   3. CRITICAL: by default, GPT-5 spends its entire completion token
 *      budget on invisible reasoning tokens and returns ZERO visible
 *      output for template-following JSON tasks like every engine in
 *      this app — confirmed live: a 1500-token budget returned 0 visible
 *      characters and unparseable JSON without this set.
 *      `reasoning_effort: 'minimal'` is mandatory at every call site, not
 *      a tuning knob — these are extraction/formatting tasks, not the
 *      kind of multi-step problem reasoning effort is for, and content
 *      quality (e.g. word-count adherence) was unaffected at 'minimal' in
 *      testing.
 *
 * response_format: { type: 'json_object' } and the messages array shape
 * are otherwise unchanged from the gpt-4o call sites.
 *
 * CHAT_MODEL is overridable via the CHAT_MODEL env var so local dev/test
 * iteration can run on a cheaper model without touching code — set
 * CHAT_MODEL=gpt-5-nano in .env.development.local (gitignored, loaded only
 * by `npm run dev`, same pattern already used to point local MYSQL_* vars
 * at XAMPP instead of production). Production's .env.local has no such
 * override, so it always falls through to the 'gpt-5' default below.
 *
 * Confirmed live: gpt-5-nano hits the same max_completion_tokens/
 * temperature/reasoning_effort constraints as gpt-5 (so no other code
 * changes needed), but is NOT a safe swap for the deep, multi-constraint
 * report generation this app does for paying clients — it reliably hits
 * array-length requirements (paragraph/step counts) but badly undershoots
 * the per-item word-count requirements (e.g. 55-65 word paragraphs came
 * back as short as 28 words, well under half the target). Fine for cheap
 * iteration where you're checking plumbing, not content depth; not fine
 * for verifying final output quality before shipping.
 */

// gpt-5 is now the default: confirmed live that the production OpenAI key
// has gpt-5 access, and gpt-4o's 30,000 TPM rate limit was the root cause of
// Value Scan failing/needing a wait after a handful of reports — gpt-5's
// 500,000 TPM headroom on this account fixes that. Override with
// CHAT_MODEL=gpt-4o in Hostinger's environment variables only if gpt-5 needs
// to be rolled back for some reason.
export const CHAT_MODEL = process.env.CHAT_MODEL || 'gpt-5';

// reasoning_effort is only valid for reasoning models (gpt-5, o1, o3).
// For standard models like gpt-4o it must be omitted. The OpenAI SDK strips
// undefined values so every call site can safely spread `reasoning_effort:
// REASONING_EFFORT` regardless of which model is active.
function isReasoningModel(m: string) {
  return /^(gpt-5|o1|o3|o\d)/.test(m);
}
export const REASONING_EFFORT: 'minimal' | undefined = isReasoningModel(CHAT_MODEL) ? 'minimal' : undefined;
