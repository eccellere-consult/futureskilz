import "server-only";

import { NextResponse } from "next/server";

import type { SessionClient } from "@/lib/auth";
import { getBusinessContext, businessContextToPromptBlock } from "@/lib/businessContext";
import { AiUnavailableError, ProviderFailureError, chatCompletionContentWithFailover, type Provider } from "@/lib/llmClient";
import type { FillinScope } from "@/lib/strategyFillins";
import { ensureSectionToolsSeeded, getEffectiveLinks, getStrategyFrameworkByToolId, type StrategyFrameworkRow } from "@/lib/strategyFrameworks";
import type { PromptContext } from "@/lib/strategyHubAi";
import { loadConnections, upstreamPromptBlock, type Connections } from "@/lib/strategyHubConnections";
import { caseBlock, getCase, type WorkspaceCase } from "@/lib/workspaceCases";

import { PROBLEM_SOLVING } from "./section";
import { PROBLEM_SOLVING_SEED, SECTION } from "./seed";

/**
 * What every Problem Solving route shares (references/04 §2): the catalogue is seeded once, a tool must be published, the
 * case comes from the request but is checked against the signed-in learner, the AI context is built the same way for every
 * job, a cut-off AI reply is retried once and never parsed, and every error a person sees is in plain words.
 */

export { SECTION };

export const seedSection = () => ensureSectionToolsSeeded(SECTION, PROBLEM_SOLVING_SEED);

/** The tool, only when it exists in this section and is published. */
export async function publishedTool(toolId: string): Promise<StrategyFrameworkRow | null> {
  await seedSection();
  const tool = await getStrategyFrameworkByToolId(SECTION, toolId);
  return tool && tool.status === "published" ? tool : null;
}

export const fail = (status: number, error: string) => NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });

export type CaseResolution = { scope: FillinScope; problem: WorkspaceCase } | { response: NextResponse };

/** Problem Solving is case scoped: every saved tool belongs to one of the learner's own problems. */
export async function resolveCase(client: SessionClient, rawCaseId: unknown): Promise<CaseResolution> {
  const caseId = Number(rawCaseId);
  if (!Number.isInteger(caseId) || caseId <= 0) return { response: fail(400, "Choose or start a problem first.") };
  const problem = await getCase(client.id, SECTION, caseId);
  if (!problem) return { response: fail(404, "Problem not found.") };
  return { scope: { clientId: client.id, section: SECTION, caseId }, problem };
}

/** The upstream and downstream work of the same problem; empty when it cannot be read (the AI then works without it). */
export async function connectionsFor(scope: FillinScope, toolId: string): Promise<Connections> {
  return getEffectiveLinks(SECTION, toolId)
    .then((links) => loadConnections(scope, links))
    .catch(() => ({ upstream: [], downstream: [] }));
}

/** Everything the AI is grounded in for one tool of one problem. */
export async function promptContextFor(client: SessionClient, problem: WorkspaceCase, connections: Connections): Promise<PromptContext> {
  const learner = await getBusinessContext(client.id).catch(() => null);
  return {
    caseBlock: caseBlock(problem),
    contextBlock: businessContextToPromptBlock(learner),
    valueScanBlock: "",
    upstreamBlock: upstreamPromptBlock(connections.upstream),
    persona: PROBLEM_SOLVING.persona,
    toolKind: "problem-solving method",
  };
}

type Build = Parameters<typeof chatCompletionContentWithFailover>[0];

export class CutOffReplyError extends Error {
  constructor() {
    super("The AI's answer was cut off before it finished. Please try again; if it keeps happening, shorten the longest answers.");
    this.name = "CutOffReplyError";
  }
}

/**
 * Asks for a JSON answer. A reply that stopped because it ran out of room (finishReason "length") is cut-off JSON: it is asked
 * for once more and never parsed (SKILL §13, a quirk of the Strategy Hub designed out here).
 */
export async function askJson(build: Build): Promise<string> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { content, finishReason } = await chatCompletionContentWithFailover(build);
    if (finishReason !== "length") return content;
  }
  throw new CutOffReplyError();
}

/** A route's error as a person should read it: what is wrong and what to do, never a stack trace or a secret. */
export function errorResponse(error: unknown, where: string, fallback: string): NextResponse {
  if (error instanceof AiUnavailableError) return fail(503, error.message);
  if (error instanceof ProviderFailureError) return fail(503, error.failure.message);
  if (error instanceof CutOffReplyError) return fail(502, error.message);
  console.error(`[problem-solving/${where}]`, error instanceof Error ? error.message : error);
  return fail(500, fallback);
}

export type { Provider };
