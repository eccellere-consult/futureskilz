/**
 * POST /api/self-service/upload — the document adapter of the framework workspace engine (references/07 §2, adapter 6): a PDF,
 * Word (.docx) or text file becomes plain text, so a tool page can ask the AI to pick out the answers it states. Signed-in
 * only, 5 MB cap, nothing is stored: the file is read in memory and only its text is returned.
 */
import mammoth from "mammoth";
import { NextRequest, NextResponse } from "next/server";
import { PDFParse } from "pdf-parse";

import { getSessionClient } from "@/lib/auth";
import { fail } from "@/lib/problemSolving/server";

export const maxDuration = 60;

const MAX_BYTES = 5 * 1024 * 1024;

async function textOf(file: File): Promise<string | null> {
  const name = file.name.toLowerCase();
  const bytes = Buffer.from(await file.arrayBuffer());
  if (name.endsWith(".pdf")) {
    const parser = new PDFParse({ data: bytes });
    try {
      return (await parser.getText()).text;
    } finally {
      await parser.destroy();
    }
  }
  if (name.endsWith(".docx")) return (await mammoth.extractRawText({ buffer: bytes })).value;
  if (name.endsWith(".txt") || name.endsWith(".md") || name.endsWith(".csv")) return bytes.toString("utf8");
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const client = await getSessionClient(req);
    if (!client) return fail(401, "Unauthorised");
    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) return fail(400, "No file was uploaded.");
    if (file.size > MAX_BYTES) return fail(413, "That file is larger than 5 MB.");

    const text = await textOf(file);
    if (text === null) return fail(415, "Upload a PDF, a Word (.docx) or a text file, or this tool's Excel template.");
    if (!text.trim()) return fail(422, "No readable text was found in that file. If it is a scanned PDF, copy the text into the form instead.");
    return NextResponse.json({ text });
  } catch (error) {
    console.error("[self-service/upload]", error instanceof Error ? error.message : error);
    return fail(500, "That file could not be read. Please try a different copy of it.");
  }
}
