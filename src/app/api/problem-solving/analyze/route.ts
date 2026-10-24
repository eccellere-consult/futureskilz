/**
 * POST /api/problem-solving/analyze — "Analyse & recommend": a verdict, summary, findings and watch-outs, recommendations and
 * actions, written from the learner's answers to this tool, grounded in the problem's brief, their profile and the work of
 * the tools this one builds on (same problem). The tool's worked-out figures are given to the AI to use, not recompute. Saved
 * here, stamped with the fingerprint of the answers it was written from, so a later edit shows it as out of date.
 */
import { NextRequest, NextResponse } from "next/server";

import { getSessionClient } from "@/lib/auth";
import { modelFor } from "@/lib/llmClient";
import { askJson, connectionsFor, errorResponse, fail, promptContextFor, publishedTool, resolveCase } from "@/lib/problemSolving/server";
import { getFillin, saveFillin } from "@/lib/strategyFillins";
import { alignFields, countFilled, fillinStatus } from "@/lib/strategyFillinTypes";
import { buildAnalyzeMessages, canonicaliseClientFields, cleanClientFields, hasAnyOutput, parseAnalysis, type ParsedAnalysis } from "@/lib/strategyHubAi";
import { usedUpstreamNames } from "@/lib/strategyHubConnections";
import { getFrameworkSkill } from "@/lib/strategyHubSkill";
import { getModelDefinition } from "@/lib/strategyModels/registry";
import { genericStructure } from "@/lib/strategyModels/structure";

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const client = await getSessionClient(req);
    if (!client) return fail(401, "Unauthorised");

    const body = (await req.json().catch(() => null)) as { toolId?: string; caseId?: unknown; fields?: unknown } | null;
    if (!body) return fail(400, "Invalid JSON body");
    const toolId = body.toolId?.trim();
    if (!toolId) return fail(400, "Missing toolId");
    const framework = await publishedTool(toolId);
    if (!framework) return fail(404, "Tool not found");
    const resolved = await resolveCase(client, body.caseId);
    if ("response" in resolved) return resolved.response;
    const { scope, problem } = resolved;

    const model = getModelDefinition(toolId);
    const structure = model ?? genericStructure(framework.fields);
    const saved = await getFillin(scope, toolId);
    const posted = canonicaliseClientFields(structure, Array.isArray(body.fields) ? cleanClientFields(body.fields) : cleanClientFields(saved?.fields ?? []));
    const fields = alignFields(framework.fields, posted);
    if (countFilled(fields) === 0) {
      return fail(400, "Fill in at least one part first: the analysis is written from your own answers, not from nothing.");
    }

    const connections = await connectionsFor(scope, toolId);
    const [ctx, methodology] = await Promise.all([promptContextFor(client, problem, connections), getFrameworkSkill(framework)]);
    const { system, user } = buildAnalyzeMessages({ framework, structure, analysisGuide: model?.analysisGuide, methodology, fields, ctx });

    const content = await askJson((provider) => {
      const { model: name, reasoningEffort } = modelFor(provider);
      return {
        model: name,
        reasoning_effort: reasoningEffort,
        max_completion_tokens: 16000,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      };
    });

    let parsed: ParsedAnalysis;
    try {
      parsed = parseAnalysis(content);
    } catch {
      return fail(502, "The AI's answer could not be read. Please try again.");
    }
    if (!hasAnyOutput(parsed)) return fail(502, "The AI could not write an analysis this time. Please try again.");

    const record = await saveFillin(scope, toolId, {
      fields,
      analysis: parsed.analysis,
      recommendations: parsed.recommendations,
      actionables: parsed.actionables,
    });

    return NextResponse.json({
      record,
      status: fillinStatus(record),
      hasBusinessContext: ctx.contextBlock.length > 0,
      hasValueScan: false,
      usedUpstream: usedUpstreamNames(connections.upstream),
    });
  } catch (error) {
    return errorResponse(error, "analyze", "The analysis did not work this time. Please try again.");
  }
}
