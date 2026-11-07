import "server-only";

import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import * as XLSX from "xlsx";

/**
 * Reads an uploaded document into text pieces that keep their location (page, sheet and row range), so a fact taken from
 * a document can say exactly where. Uploaded text is evidence to read, never instructions to follow.
 */
export type UploadPiece = { locator: string; text: string };
export type UploadReading = { status: "extracted" | "unsupported" | "failed"; pieces: UploadPiece[]; note?: string };

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_PIECE_CHARS = 4000;

export const SUPPORTED_EXTENSIONS = [".pdf", ".docx", ".txt", ".md", ".csv", ".xlsx", ".xls"];

function chunk(text: string, locator: string): UploadPiece[] {
  const clean = text.replace(/\r/g, "").replace(/[ \t]+\n/g, "\n").trim();
  if (!clean) return [];
  const pieces: UploadPiece[] = [];
  let part = 1;
  for (let i = 0; i < clean.length; i += MAX_PIECE_CHARS) {
    // Break on a paragraph boundary where we can, so a quote is a whole thought.
    let end = Math.min(clean.length, i + MAX_PIECE_CHARS);
    if (end < clean.length) {
      const boundary = clean.lastIndexOf("\n", end);
      if (boundary > i + MAX_PIECE_CHARS / 2) end = boundary;
    }
    pieces.push({ locator: clean.length > MAX_PIECE_CHARS ? `${locator}, part ${part}` : locator, text: clean.slice(i, end).trim() });
    part += 1;
    i = end - MAX_PIECE_CHARS;
    if (end >= clean.length) break;
  }
  return pieces.filter((piece) => piece.text);
}

export async function readUpload(filename: string, bytes: Buffer): Promise<UploadReading> {
  const name = filename.toLowerCase();
  try {
    if (name.endsWith(".pdf")) {
      const parser = new PDFParse({ data: bytes });
      try {
        const result = await parser.getText();
        const pages = (result as { pages?: Array<{ num?: number; text: string }> }).pages;
        const pieces = pages?.length
          ? pages.flatMap((page, index) => chunk(page.text, `page ${page.num ?? index + 1}`))
          : chunk(result.text, "document");
        return pieces.length ? { status: "extracted", pieces } : { status: "failed", pieces: [], note: "No readable text was found. If this is a scan, paste the text into the interview instead." };
      } finally {
        await parser.destroy();
      }
    }
    if (name.endsWith(".docx")) {
      const text = (await mammoth.extractRawText({ buffer: bytes })).value;
      const pieces = chunk(text, "document");
      return pieces.length ? { status: "extracted", pieces } : { status: "failed", pieces: [], note: "The document has no readable text." };
    }
    if (name.endsWith(".txt") || name.endsWith(".md")) {
      const pieces = chunk(bytes.toString("utf8"), "document");
      return pieces.length ? { status: "extracted", pieces } : { status: "failed", pieces: [], note: "The file is empty." };
    }
    if (name.endsWith(".csv") || name.endsWith(".xlsx") || name.endsWith(".xls")) {
      const workbook = XLSX.read(bytes, { type: "buffer", cellFormula: false, cellHTML: false });
      const pieces: UploadPiece[] = [];
      for (const sheetName of workbook.SheetNames.slice(0, 8)) {
        const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], { header: 1, blankrows: false, defval: "" }) as unknown[][];
        for (let start = 0; start < rows.length && start < 400; start += 40) {
          const slice = rows.slice(start, start + 40);
          pieces.push(...chunk(slice.map((row) => row.map((cell) => String(cell ?? "")).join(" | ")).join("\n"), `sheet "${sheetName}", rows ${start + 1}-${start + slice.length}`));
        }
      }
      return pieces.length ? { status: "extracted", pieces } : { status: "failed", pieces: [], note: "The spreadsheet has no readable cells." };
    }
    return { status: "unsupported", pieces: [], note: "This file type is stored for the record but not read yet. Supported: PDF, Word (.docx), text, CSV and Excel." };
  } catch (error) {
    console.warn("[capture] upload could not be read:", error instanceof Error ? error.message : error);
    return { status: "failed", pieces: [], note: "The file could not be read. Try another copy of it." };
  }
}
