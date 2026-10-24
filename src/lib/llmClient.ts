/**
 * llmClient.ts — provider-agnostic chat completions with automatic failover.
 *
 * Every AI engine in this app calls OpenAI directly today. This adds xAI's
 * Grok as a second provider without touching each call site's actual prompt
 * logic: xAI exposes an OpenAI-compatible /chat/completions endpoint (same
 * request/response shape, same `openai` SDK — just a different baseURL, key,
 * and model string), so both providers share one client type.
 *
 * The primary provider is admin-toggleable at /admin/llm-settings (persisted
 * in the app_settings table, see getPrimaryProvider/setPrimaryProvider below)
 * — a single global switch, not a per-tool setting, and it takes effect on
 * the very next AI call with no restart/redeploy. LLM_PROVIDER (env var) is
 * only the fallback default before any admin has ever touched the setting.
 * Whichever provider is NOT primary is the automatic fallback: if the
 * primary call throws (rate limit, quota, outage — like the OpenAI 429 that
 * broke the CEO Cockpit deep-dive), the request is retried once against the
 * other provider before failing. Callers see one Promise; they don't need to
 * know which provider actually served the response.
 *
 * Each provider has its OWN key and nothing else is ever sent in its place:
 * OPENAI_API_KEY for OpenAI, XAI_API_KEY for Grok. A provider whose key is
 * missing (or blank) is never called at all. (The `openai` SDK quietly falls
 * back to OPENAI_API_KEY when it is handed no key, which used to send the
 * OpenAI key to api.x.ai whenever XAI_API_KEY was not set — xAI answered
 * "Incorrect API key" and that second error hid the real one.)
 *
 * When every provider fails the caller gets ONE error (AiUnavailableError)
 * whose message says, in plain words, what is wrong with each provider:
 * "OpenAI has no credit left … Grok (xAI) is not set up on this server …".
 * Secrets are removed from anything logged or thrown. checkProvider() makes
 * one tiny real call so the admin page can show whether a provider works.
 */

// FUTURESKILZ ADAPTATION (copied from the Eccellere Strategy Hub, commit f9c3ab4): there is no app_settings table or admin
// switch here. The primary provider comes from FutureSkilz's own AI_PROVIDER setting ("openai", "xai" or "auto"), and the
// AI is switched off entirely while AI_PROVIDER is "deterministic" or unset, the same rule FutureSkilz's other AI features
// follow. OPENAI_BASE_URL (read by the openai SDK itself) points the tests at a fake server.
import OpenAI from 'openai';
import { CHAT_MODEL, REASONING_EFFORT } from './openaiModel';

export type Provider = 'openai' | 'grok';

export const PROVIDERS: readonly Provider[] = ['openai', 'grok'];
export const PROVIDER_LABEL: Record<Provider, string> = { openai: 'OpenAI', grok: 'Grok (xAI)' };
const KEY_VAR: Record<Provider, string> = { openai: 'OPENAI_API_KEY', grok: 'XAI_API_KEY' };
const MODEL_HINT: Record<Provider, string> = {
  openai: 'Set CHAT_MODEL to a model this OpenAI account can use.',
  grok: 'Set GROK_MODEL to a model this xAI account can use.',
};
const BILLING_HINT: Record<Provider, string> = { openai: 'platform.openai.com/settings/organization/billing', grok: 'console.x.ai' };

const XAI_BASE_URL = 'https://api.x.ai/v1';
const GROK_MODEL = process.env.GROK_MODEL || 'grok-4.5';

// ── Keys ────────────────────────────────────────────────────────────────────

/** The key for a provider, trimmed — or null when it is missing or blank. Nothing else is ever used in its place. */
export function apiKeyFor(provider: Provider): string | null {
  if (!isAiSwitchedOn()) return null;
  const raw = process.env[KEY_VAR[provider]];
  const key = typeof raw === 'string' ? raw.trim() : '';
  return key ? key : null;
}

/** FutureSkilz: AI runs only when AI_PROVIDER names a real provider (or "auto"); "deterministic" or unset keeps it off. */
export function isAiSwitchedOn(): boolean {
  const setting = (process.env.AI_PROVIDER ?? '').trim().toLowerCase();
  return setting === 'openai' || setting === 'xai' || setting === 'auto';
}

export const isProviderConfigured = (provider: Provider): boolean => apiKeyFor(provider) !== null;

/** The name of the environment variable that holds a provider's key (for messages; never its value). */
export const keyVarFor = (provider: Provider): string => KEY_VAR[provider];

const SECRET_PATTERNS: RegExp[] = [/\b(?:sk|xai|gsk|pk|rk)-[A-Za-z0-9_-]{8,}/g, /Bearer\s+[A-Za-z0-9._-]{12,}/gi];

/** Text with every secret removed: the configured keys themselves, and anything shaped like an API key. */
export function redactSecrets(text: string): string {
  let out = String(text ?? '');
  for (const p of PROVIDERS) {
    const key = apiKeyFor(p);
    if (key && key.length >= 8) out = out.split(key).join('[hidden]');
  }
  for (const re of SECRET_PATTERNS) out = out.replace(re, '[hidden]');
  return out;
}

// ── What went wrong, in words ──────────────────────────────────────────────

export type FailureKind = 'not_configured' | 'no_credit' | 'bad_key' | 'rate_limited' | 'model_unavailable' | 'provider_down' | 'network' | 'other';

export interface ProviderFailure {
  provider: Provider;
  kind: FailureKind;
  status: number | null;
  /** Plain words for a person: what is wrong and what to do about it. */
  message: string;
  /** The provider's own words (secrets removed), for the log. */
  detail: string;
}

export class ProviderFailureError extends Error {
  constructor(public failure: ProviderFailure) {
    super(failure.message);
    this.name = 'ProviderFailureError';
  }
}

/** Thrown when no provider could answer: one message that names the problem with each one. */
export class AiUnavailableError extends Error {
  constructor(public failures: ProviderFailure[]) {
    super(unavailableMessage(failures));
    this.name = 'AiUnavailableError';
  }
}

function messageFor(provider: Provider, kind: FailureKind, o: { status: number | null; detail: string; model: string }): string {
  const name = PROVIDER_LABEL[provider];
  switch (kind) {
    case 'not_configured': return `${name} is not set up on this server (${KEY_VAR[provider]} is missing).`;
    case 'no_credit': return `${name} has no credit left. Add credit in the ${name} account (${BILLING_HINT[provider]}).`;
    case 'bad_key': return `${name} refused the key. Check that ${KEY_VAR[provider]} holds the right, current key.`;
    case 'model_unavailable': return `${name} has no model called “${o.model}” for this key. ${MODEL_HINT[provider]}`;
    case 'rate_limited': return `${name} is busy (too many requests). Try again in a minute.`;
    case 'provider_down': return `${name} is having a problem on its own side right now. Try again shortly.`;
    case 'network': return `This server could not reach ${name}. Check the internet connection.`;
    default: return `${name} answered with an error${o.status ? ` (${o.status})` : ''}: ${o.detail.slice(0, 160) || 'no details given'}`;
  }
}

function modelOf(provider: Provider): string {
  return provider === 'grok' ? GROK_MODEL : CHAT_MODEL;
}

export function failureFor(provider: Provider, kind: FailureKind, o: { status?: number | null; detail?: string; model?: string } = {}): ProviderFailure {
  const status = o.status ?? null;
  const detail = redactSecrets(o.detail ?? '');
  return { provider, kind, status, detail, message: messageFor(provider, kind, { status, detail, model: o.model ?? modelOf(provider) }) };
}

/** Turns whatever a provider's SDK threw into a ProviderFailure: what kind of problem it is, and what to tell a person. */
export function classifyFailure(provider: Provider, err: unknown, model?: string): ProviderFailure {
  if (err instanceof ProviderFailureError) return err.failure;
  const e = (err ?? {}) as { status?: unknown; code?: unknown; type?: unknown; name?: unknown; message?: unknown; error?: { code?: unknown; type?: unknown; message?: unknown } | null };
  const status = typeof e.status === 'number' ? e.status : null;
  const code = String(e.code ?? e.error?.code ?? '');
  const type = String(e.type ?? e.error?.type ?? '');
  const raw = String(e.error?.message ?? e.message ?? (typeof err === 'string' ? err : ''));
  const lower = `${code} ${type} ${raw}`.toLowerCase();
  const name = String(e.name ?? '');
  let kind: FailureKind = 'other';
  // Quota comes before "too many requests": OpenAI answers an empty balance with HTTP 429.
  if (status === 402 || /insufficient_quota|credit_balance|no credits|out of credits|run out of credits|used all (?:of )?(?:its |your |the )?available credits|spending limit|exceeded your current quota|insufficient (?:balance|funds)|(?:doesn't|does not) have any credits|billing/.test(lower)) kind = 'no_credit';
  else if (status === 401 || /incorrect api key|invalid api key|invalid_api_key|unauthori[sz]ed|authentication|api key (?:is )?(?:invalid|expired|revoked)/.test(lower)) kind = 'bad_key';
  else if (status === 404 || /model_not_found|does not exist|not have access to (?:the )?model|unknown model|model .{0,60}(?:not found|unavailable|deprecated)/.test(lower)) kind = 'model_unavailable';
  else if (status === 429 || /rate.?limit|too many requests/.test(lower)) kind = 'rate_limited';
  else if ((status !== null && status >= 500) || /overloaded|temporarily unavailable|bad gateway|service unavailable/.test(lower)) kind = 'provider_down';
  else if (/APIConnection|APIConnectionTimeout/i.test(name) || /econnrefused|enotfound|etimedout|econnreset|eai_again|fetch failed|socket hang up|network|timed out|timeout/.test(lower)) kind = 'network';
  return failureFor(provider, kind, { status, detail: raw, model });
}

function unavailableMessage(failures: ProviderFailure[]): string {
  if (!failures.length) return 'The AI could not answer.';
  if (failures.every((f) => f.kind === 'not_configured')) {
    if (!isAiSwitchedOn()) return 'The AI is switched off on this site. To switch it on, set AI_PROVIDER to "openai" (or "xai") and add the matching key in the server settings.';
    return `No AI provider is set up on this server. Add ${PROVIDERS.map((p) => KEY_VAR[p]).join(' or ')} to the server settings.`;
  }
  return `The AI could not answer. ${failures.map((f) => f.message).join(' ')}`;
}

// ── Clients ─────────────────────────────────────────────────────────────────

const clients: Partial<Record<Provider, { client: OpenAI; key: string }>> = {};

/** The client for a provider. Throws a ProviderFailureError (kind not_configured) when it has no key: it never borrows another provider's. */
export function getClient(provider: Provider): OpenAI {
  const key = apiKeyFor(provider);
  if (!key) throw new ProviderFailureError(failureFor(provider, 'not_configured'));
  const cached = clients[provider];
  if (cached && cached.key === key) return cached.client;
  const client = provider === 'grok'
    ? new OpenAI({ apiKey: key, baseURL: XAI_BASE_URL })
    : new OpenAI({ apiKey: key });
  clients[provider] = { client, key };
  return client;
}

type ChatParams = OpenAI.Chat.ChatCompletionCreateParamsNonStreaming;
type ReasoningEffort = ChatParams['reasoning_effort'];

/**
 * Model + reasoning_effort for the app's standard "extraction/formatting"
 * call sites (the ones already built around CHAT_MODEL/REASONING_EFFORT).
 * Grok's reasoning_effort accepts 'none'|'low'|'medium'|'high' (defaults to
 * 'high' if omitted) — a different enum from OpenAI's gpt-5 'minimal', but
 * the same intent: these are template-following JSON tasks, not multi-step
 * reasoning problems, so 'low' is the closest fast/cheap analog to OpenAI's
 * mandatory 'minimal' rather than leaving Grok at its slower 'high' default.
 * Typed against the OpenAI SDK's own reasoning_effort union (via ChatParams)
 * rather than a bare string — 'low' satisfies both OpenAI's and, per xAI's
 * docs, Grok's accepted values, so no runtime cast is needed, only the type.
 */
export function modelFor(provider: Provider): { model: string; reasoningEffort: ReasoningEffort } {
  if (provider === 'grok') {
    return { model: GROK_MODEL, reasoningEffort: 'low' as ReasoningEffort };
  }
  return { model: CHAT_MODEL, reasoningEffort: REASONING_EFFORT as ReasoningEffort };
}

// ── Primary provider ────────────────────────────────────────────────────────
// FutureSkilz: read from AI_PROVIDER (no admin switch or settings table). "xai" puts Grok first; anything else OpenAI.

/** The provider tried first; the other one is the automatic fallback. */
export async function getPrimaryProvider(): Promise<Provider> {
  return (process.env.AI_PROVIDER ?? '').trim().toLowerCase() === 'xai' ? 'grok' : 'openai';
}

/**
 * Runs a chat completion against the current primary provider; on failure,
 * logs and retries once against the other provider. `build(provider)`
 * constructs the full request params for whichever provider is about to be
 * tried, so each call site controls its own model/reasoning_effort/
 * response_format — this function only owns provider selection and the
 * fallback retry.
 *
 * A provider with no key is skipped without a call. If neither provider can
 * answer, throws an AiUnavailableError naming the problem with each.
 */
export async function chatCompletionWithFailover(
  build: (provider: Provider) => ChatParams
): Promise<OpenAI.Chat.ChatCompletion> {
  const primary = await getPrimaryProvider();
  const secondary: Provider = primary === 'openai' ? 'grok' : 'openai';
  const failures: ProviderFailure[] = [];
  for (const provider of [primary, secondary]) {
    if (!isProviderConfigured(provider)) {
      failures.push(failureFor(provider, 'not_configured'));
      continue;
    }
    try {
      return await getClient(provider).chat.completions.create(build(provider));
    } catch (err) {
      const failure = classifyFailure(provider, err);
      failures.push(failure);
      console.error(`[llmClient] ${provider} failed (${failure.kind}${failure.status ? `, ${failure.status}` : ''}): ${failure.detail.slice(0, 300)}`);
    }
  }
  throw new AiUnavailableError(failures);
}

export interface ChatCompletionContent {
  content: string;
  finishReason: string | null;
}

/**
 * Runs chatCompletionWithFailover and returns the completion's raw text
 * content, guaranteed non-empty (or throws a clear error) — every call
 * site across this app used to do its own
 * `completion.choices[0].message.content ?? '{}'` before JSON.parse, but
 * `??` only substitutes on null/undefined, never on ''. A reasoning model
 * can return message.content === '' when max_completion_tokens is consumed
 * entirely by hidden reasoning tokens before any visible output (more
 * likely on large/complex prompts) — that reached JSON.parse('') and threw
 * the opaque native "Unexpected end of JSON input" straight through to
 * whatever UI displayed the caught error message. Retries once (empty
 * content is usually a transient miss, not deterministic) before failing
 * with a message that explains what actually happened.
 *
 * Returns finishReason alongside content so callers that already check
 * for 'length' (truncation — a different, pre-existing concern this
 * doesn't replace) keep that ability without a second completions call.
 */
export async function chatCompletionContentWithFailover(
  build: (provider: Provider) => ChatParams
): Promise<ChatCompletionContent> {
  async function attempt(): Promise<ChatCompletionContent> {
    const completion = await chatCompletionWithFailover(build);
    const choice = completion.choices[0];
    return { content: choice.message.content ?? '', finishReason: choice.finish_reason ?? null };
  }
  let result = await attempt();
  if (!result.content.trim()) result = await attempt();
  if (!result.content.trim()) {
    throw new Error('The AI returned an empty response after retrying — this can happen with very large or complex input. Please try again.');
  }
  return result;
}

// ── Health check ────────────────────────────────────────────────────────────

export interface ProviderHealth {
  provider: Provider;
  name: string;
  /** The environment variable the key lives in (never the key itself). */
  keyVar: string;
  configured: boolean;
  model: string;
  /** This is the provider the admin has chosen as primary. */
  active: boolean;
  ok: boolean;
  kind: FailureKind | 'ok';
  /** What happened, in plain words. */
  message: string;
  ms: number | null;
}

/**
 * One tiny real question to a provider ("Reply with the single word OK."), to show whether its key, its credit and its model work.
 * No retries and a short timeout, so a button on the admin page answers within seconds. Never throws.
 */
export async function checkProvider(provider: Provider, active = false): Promise<ProviderHealth> {
  const { model, reasoningEffort } = modelFor(provider);
  const base = { provider, name: PROVIDER_LABEL[provider], keyVar: KEY_VAR[provider], configured: isProviderConfigured(provider), model, active };
  if (!base.configured) {
    const f = failureFor(provider, 'not_configured', { model });
    return { ...base, ok: false, kind: f.kind, message: f.message, ms: null };
  }
  const started = Date.now();
  try {
    await getClient(provider).chat.completions.create(
      { model, messages: [{ role: 'user', content: 'Reply with the single word OK.' }], max_completion_tokens: 64, reasoning_effort: reasoningEffort },
      { timeout: 20_000, maxRetries: 0 },
    );
    const ms = Date.now() - started;
    return { ...base, ok: true, kind: 'ok', message: `Working: ${base.name} answered in ${(ms / 1000).toFixed(1)} s.`, ms };
  } catch (err) {
    const f = classifyFailure(provider, err, model);
    return { ...base, ok: false, kind: f.kind, message: f.message, ms: Date.now() - started };
  }
}

/** Checks one provider, or both, and says which one is primary. */
export async function checkProviders(which?: Provider): Promise<{ primary: Provider; results: ProviderHealth[] }> {
  const primary = await getPrimaryProvider();
  const list = which ? [which] : [...PROVIDERS];
  const results = await Promise.all(list.map((p) => checkProvider(p, p === primary)));
  return { primary, results };
}
