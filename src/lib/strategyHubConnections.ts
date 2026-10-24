/**
 * strategyHubConnections.ts — the golden thread as data: for one tool, what the client has already saved in the tools it
 * builds on (upstream) and in the tools it feeds (downstream).
 *
 * Upstream work is what makes the Hub a connected system rather than a folder of forms: a tool's saved answers, analysis
 * and recommendations are handed to the AI as established inputs when a downstream tool is filled in or analysed (see
 * upstreamPromptBlock), and shown to the client beside the tool so they can see — and open — what it builds on. For a tool
 * with a model, the named OUTPUTS the model defines (a chosen strategy, an industry-attractiveness reading, a value
 * proposition) are carried too, so a downstream field can offer them as a one-click suggestion.
 *
 * The pure half (summarising one record, formatting the prompt block) is separate from the lookup so it can be tested
 * without a database.
 */
import { listStrategyFrameworks } from './strategyFrameworks';
import { listFillins, type FillinScope } from './strategyFillins';
import { analysisHeadline, fillinStatus, type FillinRecord, type FillinStatus } from './strategyFillinTypes';
import { getModelDefinition } from './strategyModels/registry';
import { computeOutputs, renderValuesForPrompt, valuesFromFields, type OutputResult } from './strategyModels/values';

export interface ConnectedTool {
  toolId: string;
  name: string;
  status: FillinStatus;
  updatedAt: string | null;
  analysedAt: string | null;
  /** One line: the verdict, or the first sentence of the summary. */
  headline: string | null;
  summary: string | null;
  /** Up to three recommendations, in the order they were written. */
  topRecommendations: string[];
  /** The answers actually filled in, label → value (in the tool's own order). */
  filled: { label: string; value: string }[];
  /** For a tool with a model: its named outputs as they stand now (empty otherwise). */
  outputs: OutputResult[];
  /** For a tool with a model: its answers and worked-out figures as readable text, for the AI. */
  rendered: string | null;
}

export interface Connections {
  upstream: ConnectedTool[];
  downstream: ConnectedTool[];
}

/** The tool ids on each side of a tool, counting a link declared on either side (see strategyFrameworkLinks.ts). */
export interface LinkIds { upstream: string[]; downstream: string[] }

/** What one saved record means as a connected tool — also what the tests exercise. */
export function summariseConnected(toolId: string, name: string, record: FillinRecord | null): ConnectedTool {
  const status = fillinStatus(record);
  const model = getModelDefinition(toolId);
  let outputs: OutputResult[] = [];
  let rendered: string | null = null;
  if (model && record && status !== 'not_started') {
    const { values } = valuesFromFields(model, record.fields);
    outputs = computeOutputs(model, values);
    rendered = renderValuesForPrompt(model, values, { skipBlank: true, includeDerived: true }) || null;
  }
  return {
    toolId,
    name,
    status,
    updatedAt: record?.updatedAt ?? null,
    analysedAt: record?.analysisAt ?? null,
    headline: analysisHeadline(record?.analysis ?? null),
    summary: record?.analysis?.summary?.trim() || null,
    topRecommendations: (record?.recommendations ?? []).slice(0, 3).map((r) => r.text),
    filled: (record?.fields ?? []).filter((f) => (f.value ?? '').trim()).map((f) => ({ label: f.label, value: f.value.trim() })),
    outputs,
    rendered,
  };
}

/** FUTURESKILZ: takes a scope, so upstream and downstream work is read from the SAME problem (references/05 §3.2). */
export async function loadConnections(scope: FillinScope, links: LinkIds): Promise<Connections> {
  const [catalogue, saved] = await Promise.all([listStrategyFrameworks(scope.section), listFillins(scope)]);
  const nameOf = new Map(catalogue.map((f) => [f.toolId, f.name]));
  const byTool = new Map(saved.map((r) => [r.toolId, r]));
  const build = (ids: string[]): ConnectedTool[] =>
    ids.filter((id) => nameOf.has(id)).map((id) => summariseConnected(id, nameOf.get(id)!, byTool.get(id) ?? null));
  return { upstream: build(links.upstream), downstream: build(links.downstream) };
}

/** Longest single answer passed on as context. The client's own saved text is never truncated in storage — this only
 * keeps one runaway field from crowding the rest of a prompt. */
const MAX_VALUE_CHARS = 1500;

/**
 * The block handed to the AI: the client's saved work in the tools this one builds on. Empty string when none of them has
 * anything yet (so a prompt built from it is unchanged for a client who has not used the earlier tools).
 */
export function upstreamPromptBlock(upstream: ConnectedTool[]): string {
  const withWork = upstream.filter((u) => u.status !== 'not_started');
  if (withWork.length === 0) return '';
  const parts = withWork.map((u) => {
    const lines: string[] = [`[${u.name}] — ${u.status === 'stale' ? 'analysed earlier; answers edited since' : u.status === 'analysed' ? 'analysed' : 'filled in, not yet analysed'}`];
    if (u.headline) lines.push(`  Conclusion: ${u.headline}`);
    if (u.summary) lines.push(`  Summary: ${u.summary}`);
    if (u.rendered) {
      // A tool with a model: its answers (tables as rows, worked-out figures included) as the model's own structure.
      lines.push('  Answers:');
      for (const row of u.rendered.split('\n')) lines.push(`  ${row.length > MAX_VALUE_CHARS ? `${row.slice(0, MAX_VALUE_CHARS)}…` : row}`);
    } else if (u.filled.length > 0) {
      lines.push('  Answers:');
      for (const f of u.filled) lines.push(`  - ${f.label}: ${f.value.length > MAX_VALUE_CHARS ? `${f.value.slice(0, MAX_VALUE_CHARS)}…` : f.value}`);
    }
    if (u.topRecommendations.length > 0) {
      lines.push('  Recommendations already made:');
      u.topRecommendations.forEach((r, i) => lines.push(`  ${i + 1}. ${r}`));
    }
    return lines.join('\n');
  });
  return `SAVED WORK FROM THE TOOLS THIS ONE BUILDS ON (this client's own answers and conclusions — treat them as established inputs, stay consistent with them, and say so explicitly if you depart from one):\n\n${parts.join('\n\n')}`;
}

/** Names of the upstream tools whose saved work was passed on, for the "grounded on …" note shown to the client. */
export const usedUpstreamNames = (upstream: ConnectedTool[]): string[] => upstream.filter((u) => u.status !== 'not_started').map((u) => u.name);
