/**
 * GET /api/problem-solving/frameworks — the section's published tools with their stage, facets, plain-words guidance and the
 * golden thread (links counted from either side). Public: a signed-out visitor sees the catalogue and the worked examples.
 */
import { NextResponse } from "next/server";

import { PROBLEM_SOLVING } from "@/lib/problemSolving/section";
import { METHODS_TO_COME } from "@/lib/problemSolving/seed";
import { SECTION, errorResponse, seedSection } from "@/lib/problemSolving/server";
import { listLinkRows, listStrategyFrameworks } from "@/lib/strategyFrameworks";
import { effectiveLinks } from "@/lib/strategyFrameworkLinks";
import { getStrategyFrameworkByToolId } from "@/lib/strategyFrameworks";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await seedSection();
    const [summaries, linkRows] = await Promise.all([listStrategyFrameworks(SECTION, { status: "published" }), listLinkRows(SECTION)]);
    const links = effectiveLinks(linkRows);
    const shown = new Set(summaries.map((s) => s.toolId));
    const full = await Promise.all(summaries.map((s) => getStrategyFrameworkByToolId(SECTION, s.toolId)));
    const tools = full.flatMap((fw) =>
      fw
        ? [{
            id: fw.toolId,
            name: fw.name,
            stage: fw.layer,
            nature: fw.nature,
            fits: fw.facets.fits ?? [],
            does: fw.does,
            when: fw.whenToUse,
            whenNot: fw.whenNotToUse ?? "",
            next: fw.nextStep,
            upstream: (links.get(fw.toolId)?.upstream ?? []).filter((id) => shown.has(id)),
            downstream: (links.get(fw.toolId)?.downstream ?? []).filter((id) => shown.has(id)),
            hasModel: !!fw.hasModel,
          }]
        : [],
    );
    return NextResponse.json({
      section: { name: PROBLEM_SOLVING.name, tagline: PROBLEM_SOLVING.tagline, stages: PROBLEM_SOLVING.stages },
      tools,
      methodsToCome: METHODS_TO_COME,
    });
  } catch (error) {
    return errorResponse(error, "frameworks", "The Problem Solving tools could not be loaded. Please refresh.");
  }
}
