/**
 * strategyModels/registry.ts — the server-side lookup of every framework's model: its definition, its worked example and its
 * reference diagram. Imports every group, so only server code (routes, the catalogue, tests) should use it; the browser loads
 * definitions one group at a time through groups.ts, and never receives samples or diagram code except as the API sends them.
 *
 * FUTURESKILZ: the groups are the Problem Solving section's stages (references/01 §6). Only the stages built so far are
 * listed; each later part of the build adds its stage's three files here and in groups.ts.
 */
import { DEFINE_MODELS } from './defs/define';
import { ANALYSE_MODELS } from './defs/analyse';
import { DEFINE_SAMPLES } from './samples/define';
import { ANALYSE_SAMPLES } from './samples/analyse';
import { DEFINE_DIAGRAMS } from './diagrams/define';
import { ANALYSE_DIAGRAMS } from './diagrams/analyse';
import type { ModelDefinition, ModelSample } from './types';

export const ALL_MODELS: ModelDefinition[] = [...DEFINE_MODELS, ...ANALYSE_MODELS];

const SAMPLES: Record<string, ModelSample> = { ...DEFINE_SAMPLES, ...ANALYSE_SAMPLES };
const DIAGRAMS: Record<string, () => string> = { ...DEFINE_DIAGRAMS, ...ANALYSE_DIAGRAMS };

const BY_ID = new Map(ALL_MODELS.map((m) => [m.toolId, m]));

export const getModelDefinition = (toolId: string): ModelDefinition | null => BY_ID.get(toolId) ?? null;
export const getModelSample = (toolId: string): ModelSample | null => SAMPLES[toolId] ?? null;

/** The reference diagram as SVG markup, drawn fresh (the drawing functions are pure). Null when the framework has none. */
export function getModelDiagramSvg(toolId: string): string | null {
  const draw = DIAGRAMS[toolId];
  return draw ? draw() : null;
}

export const listModelIds = (): string[] => ALL_MODELS.map((m) => m.toolId);
