/**
 * POST /api/problem-solving/import — reads a file uploaded on a tool page and says what it is:
 *   • this tool's own filled template → { kind: 'template', fields, filled, warnings }: the answers exactly as typed, checked
 *     against what each part allows. No AI is involved;
 *   • one of our SAMPLE workbooks       → { kind: 'sample' }: the page opens the worked example. A sample is never read as the
 *     learner's own answers;
 *   • anything else (a PDF, a Word file, another spreadsheet) → { kind: 'document' }: the page uses the AI extraction path.
 * Reads and returns only; nothing is saved here (the page saves what it accepts, with an undo). The workbook is opened with
 * the vendored SheetJS after a structural check (templateKit/serverOpen.ts).
 */
import { NextRequest, NextResponse } from "next/server";

import { getSessionClient } from "@/lib/auth";
import { errorResponse, fail, publishedTool } from "@/lib/problemSolving/server";
import { strategyKit } from "@/lib/strategyModels/kit";
import { getModelDefinition } from "@/lib/strategyModels/registry";
import { genericStructure } from "@/lib/strategyModels/structure";
import { fieldsFromValues, isBlankSaved, partsOf } from "@/lib/strategyModels/values";
import { readKitWorkbook } from "@/lib/templateKit/read";
import { NotAWorkbookError, guardedServerXlsx } from "@/lib/templateKit/serverOpen";

export const maxDuration = 60;

const MAX_BYTES = 5 * 1024 * 1024;
const WORKBOOK = /[.](xlsx|xls)$/i;

export async function POST(req: NextRequest) {
  try {
    const client = await getSessionClient(req);
    if (!client) return fail(401, "Unauthorised");

    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    const toolId = String(form?.get("toolId") ?? "").trim();
    if (!toolId) return fail(400, "Missing toolId");
    if (!(file instanceof File)) return fail(400, "No file was uploaded.");
    if (file.size > MAX_BYTES) return fail(413, "That file is larger than 5 MB.");

    const framework = await publishedTool(toolId);
    if (!framework) return fail(404, "Tool not found");

    // Only a workbook can be one of our templates; anything else goes the document-extraction way.
    if (!WORKBOOK.test(file.name)) return NextResponse.json({ kind: "document" });

    const model = getModelDefinition(toolId);
    const structure = model ?? genericStructure(framework.fields);
    const kit = strategyKit({ toolId, name: framework.name, originator: model?.reference.originator, structure });

    const bytes = new Uint8Array(await file.arrayBuffer());
    let read;
    try {
      read = await readKitWorkbook(kit.def, bytes, guardedServerXlsx(bytes));
    } catch (error) {
      if (error instanceof NotAWorkbookError) return fail(400, "That file is not a readable Excel workbook. Download the blank template and try again.");
      return NextResponse.json({ kind: "document" });
    }
    if (read.isSample) return NextResponse.json({ kind: "sample" });
    if (Object.keys(read.content).length === 0) return NextResponse.json({ kind: "document" });

    const dropped: string[] = [];
    const values = kit.fromContent(read.content, dropped);
    const saved = fieldsFromValues(structure, values, Object.fromEntries(partsOf(structure).map((p) => [p.key, "Template"])));
    const fields = saved.filter((f, i) => !isBlankSaved(partsOf(structure)[i], f.value));
    return NextResponse.json({ kind: "template", fields, filled: fields.length, warnings: [...read.warnings, ...dropped] });
  } catch (error) {
    return errorResponse(error, "import", "That file could not be read. Please try again.");
  }
}
