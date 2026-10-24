/**
 * POST /api/problem-solving/extract — reads the text of an uploaded document and returns ONLY the single answers it states
 * plainly. Tables are never guessed from prose and a rating is the person's own judgement, so neither is extracted. The page
 * fills only parts that are still blank, and offers an undo.
 */
import { NextRequest, NextResponse } from "next/server";

import { getSessionClient } from "@/lib/auth";
import { extractFieldsFromDocument, type ExtractableField } from "@/lib/documentExtraction";
import { errorResponse, fail, publishedTool } from "@/lib/problemSolving/server";
import { getModelDefinition } from "@/lib/strategyModels/registry";
import { isField } from "@/lib/strategyModels/types";
import { partsOf, toNum } from "@/lib/strategyModels/values";
import { matchOption } from "@/lib/templateKit/values";

export const maxDuration = 60;

const MAX_TEXT = 200_000;

export async function POST(req: NextRequest) {
  try {
    const client = await getSessionClient(req);
    if (!client) return fail(401, "Unauthorised");

    const body = await req.json().catch(() => ({}));
    const toolId = typeof body.toolId === "string" ? body.toolId.trim() : "";
    const text = typeof body.text === "string" ? body.text.slice(0, MAX_TEXT) : "";
    if (!toolId) return fail(400, "Missing toolId");
    if (!text.trim()) return fail(400, "No document text was found in that file.");

    const framework = await publishedTool(toolId);
    if (!framework) return fail(404, "Tool not found");

    const model = getModelDefinition(toolId);
    const descriptor: ExtractableField[] = model
      ? partsOf(model)
          .filter(isField)
          .filter((p) => p.type !== "rating")
          .map((p) => ({
            id: p.label,
            label: `${p.label} — ${p.help}`,
            type: p.type === "select" ? "select" : p.type === "number" ? "number" : "textarea",
            options: p.type === "select" ? [...(p.options ?? [])] : undefined,
          }))
      : framework.fields.map((f) => ({ id: f.label, label: f.label }));
    const extracted = await extractFieldsFromDocument(descriptor, text);
    // Every value is checked against its part before it reaches the form (SKILL rule 5): a number must be a number and a
    // choice one of the part's options; anything else is dropped rather than shown as an answer.
    const partByLabel = new Map((model ? partsOf(model).filter(isField) : []).map((p) => [p.label, p]));
    const fields = Object.entries(extracted)
      .flatMap(([label, value]) => {
        const part = partByLabel.get(label);
        if (!value) return [];
        if (part?.type === "number") return toNum(value) === null ? [] : [{ label, value: String(toNum(value)) }];
        if (part?.type === "select") { const option = matchOption(value, part.options ?? []); return option ? [{ label, value: option }] : []; }
        return [{ label, value }];
      });
    return NextResponse.json({ fields });
  } catch (error) {
    return errorResponse(error, "extract", "That document could not be read this time. Please try again.");
  }
}
