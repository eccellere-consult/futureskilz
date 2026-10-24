/**
 * POST /api/problem-solving/generate — "Update with AI": drafts ONLY the parts of a tool the learner has not answered (or that
 * the AI itself wrote earlier). Every drafted value is checked against its part (an invalid choice or a malformed table row is
 * dropped), the result is saved here with a one-step undo, and the reply says what the draft was grounded on: the problem's own
 * brief, the learner's profile, and the saved work of the tools this one builds on, from the SAME problem.
 */
import { NextRequest, NextResponse } from "next/server";

import { getSessionClient } from "@/lib/auth";
import { modelFor } from "@/lib/llmClient";
import { askJson, connectionsFor, errorResponse, fail, promptContextFor, publishedTool, resolveCase } from "@/lib/problemSolving/server";
import { getFillin, saveFillin } from "@/lib/strategyFillins";
import { EMPTY_RECORD, alignFields, fillinStatus } from "@/lib/strategyFillinTypes";
import { buildGenerateMessages, canonicaliseClientFields, cleanClientFields, fillableLabels, mergeGenerated, parseGenerated } from "@/lib/strategyHubAi";
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

    const structure = getModelDefinition(toolId) ?? genericStructure(framework.fields);
    const saved = await getFillin(scope, toolId);
    // The form as the person has it now; with none sent, whatever was last saved (older labels carried over).
    const current = canonicaliseClientFields(structure, Array.isArray(body.fields) ? cleanClientFields(body.fields) : cleanClientFields(saved?.fields ?? []));
    const fillable = fillableLabels(framework, current, structure);
    if (fillable.length === 0) {
      const record = saved ?? { ...EMPTY_RECORD, fields: alignFields(framework.fields, current) };
      return NextResponse.json({ record, status: fillinStatus(record), filledLabels: [], unchanged: true, hasBusinessContext: false, hasValueScan: false, usedUpstream: [] });
    }

    const connections = await connectionsFor(scope, toolId);
    const [ctx, methodology] = await Promise.all([promptContextFor(client, problem, connections), getFrameworkSkill(framework)]);
    const { system, user } = buildGenerateMessages({ framework, structure, methodology, fillable, current, ctx });

    const content = await askJson((provider) => {
      const { model, reasoningEffort } = modelFor(provider);
      return {
        model,
        reasoning_effort: reasoningEffort,
        max_completion_tokens: 16000,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      };
    });

    let generated: Map<string, string>;
    try {
      generated = parseGenerated(content, fillable, structure);
    } catch {
      return fail(502, "The AI's answer could not be read. Please try again.");
    }
    if (generated.size === 0) return fail(502, "The AI did not return any usable answers. Please try again.");

    const merged = mergeGenerated(framework, current, fillable, generated, structure);
    const record = await saveFillin(scope, toolId, { fields: merged }, { snapshotReason: "ai" });

    return NextResponse.json({
      record,
      status: fillinStatus(record),
      filledLabels: [...generated.keys()],
      hasBusinessContext: ctx.contextBlock.length > 0,
      hasValueScan: false,
      usedUpstream: usedUpstreamNames(connections.upstream),
    });
  } catch (error) {
    return errorResponse(error, "generate", "The AI draft did not work this time. Please try again.");
  }
}
