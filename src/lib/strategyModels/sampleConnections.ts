/**
 * strategyModels/sampleConnections.ts — what a worked example's golden thread looks like: for the tools this one builds on and
 * the tools it feeds, the fictional company's own worked example for THAT tool, presented the way a client's saved work is
 * (analysed, with its conclusion and named outputs). It lets the demo show the connection — "Builds on ← Porter's Five Forces,
 * analysed: moderately unattractive industry" — without any database access. A tool with no worked example yet is simply not
 * listed as having work.
 */
import type { ConnectedTool } from '../strategyHubConnections';
import { analysisHeadline } from '../strategyFillinTypes';
import { getModelDefinition, getModelSample } from './registry';
import { computeOutputs } from './values';

/** The worked example of `toolId`, as a connected tool; null when it has none. */
export function sampleConnected(toolId: string, name: string): ConnectedTool | null {
  const def = getModelDefinition(toolId);
  const sample = getModelSample(toolId);
  if (!def || !sample) return null;
  return {
    toolId,
    name,
    status: 'analysed',
    updatedAt: null,
    analysedAt: null,
    headline: analysisHeadline(sample.analysis),
    summary: sample.analysis.summary,
    topRecommendations: sample.recommendations.slice(0, 3),
    filled: [],
    outputs: computeOutputs(def, { fields: sample.values, tables: sample.tables }),
    rendered: null,
  };
}
