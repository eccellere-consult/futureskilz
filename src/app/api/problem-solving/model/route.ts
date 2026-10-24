/**
 * GET /api/problem-solving/model?toolId=… — a tool's model: its reference (originator, summary, how to read it) and its
 * diagram; with &sample=1, the worked example and the worked examples of the tools it builds on and feeds. Public and saved
 * nowhere: this is what the signed-out page and ?demo=1 show.
 */
import { NextRequest, NextResponse } from "next/server";

import { SECTION, errorResponse, fail, publishedTool } from "@/lib/problemSolving/server";
import { getEffectiveLinks, listStrategyFrameworks } from "@/lib/strategyFrameworks";
import { getModelDefinition, getModelDiagramSvg, getModelSample } from "@/lib/strategyModels/registry";
import { sampleConnected } from "@/lib/strategyModels/sampleConnections";

export async function GET(req: NextRequest) {
  try {
    const toolId = req.nextUrl.searchParams.get("toolId")?.trim() ?? "";
    if (!toolId) return fail(400, "Missing toolId");
    const tool = await publishedTool(toolId);
    if (!tool) return fail(404, "Tool not found");

    const model = getModelDefinition(toolId);
    if (!model) return NextResponse.json({ toolId, hasModel: false });

    const sample = getModelSample(toolId);
    const body: Record<string, unknown> = {
      toolId,
      hasModel: true,
      reference: model.reference,
      diagramSvg: getModelDiagramSvg(toolId),
      sampleAvailable: !!sample,
    };

    if (req.nextUrl.searchParams.get("sample") === "1" && sample) {
      const [links, catalogue] = await Promise.all([getEffectiveLinks(SECTION, toolId), listStrategyFrameworks(SECTION, { status: "published" })]);
      const nameOf = new Map(catalogue.map((f) => [f.toolId, f.name]));
      const connect = (ids: string[]) =>
        ids.flatMap((id) => {
          const c = nameOf.has(id) ? sampleConnected(id, nameOf.get(id)!) : null;
          return c ? [c] : [];
        });
      body.sample = { ...sample, connections: { upstream: connect(links.upstream), downstream: connect(links.downstream) } };
    }
    return NextResponse.json(body);
  } catch (error) {
    return errorResponse(error, "model", "This tool's model could not be loaded. Please refresh.");
  }
}
