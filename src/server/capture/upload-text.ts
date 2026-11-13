import "server-only";

import JSZip from "jszip";

import { IMAGE_EXTENSIONS } from "@/features/intake/media";
import { MediaServiceError, transcribeImage } from "@/server/providers/openai-media";
import * as XLSX from "xlsx";

/**
 * Reads an uploaded document into text pieces that keep their location (page, sheet and row range), so a fact taken from
 * a document can say exactly where. Uploaded text is evidence to read, never instructions to follow.
 */
export type UploadPiece = { locator: string; text: string };
export type UploadReading = { status: "extracted" | "unsupported" | "failed"; pieces: UploadPiece[]; note?: string };

/** Per file. Larger files need the file store (a later step), because the server holds a whole upload in memory. */
export const MAX_UPLOAD_MB = 25;
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;
/** The most the server reads into memory from the file store. Bigger files are kept whole but not read here yet. */
export const MAX_READ_MB = 40;
export const MAX_READ_BYTES = MAX_READ_MB * 1024 * 1024;
const MAX_PIECE_CHARS = 4000;

export const SUPPORTED_EXTENSIONS = [".pdf", ".docx", ".pptx", ".txt", ".md", ".csv", ".xlsx", ".xls", ...IMAGE_EXTENSIONS];

/** The largest picture sent to the AI to be read. */
export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

const MAX_SLIDES = 200;

const unxml = (text: string): string => text.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");

/** The text of one slide or notes page, paragraph by paragraph. */
function slideText(xml: string): string {
  return (xml.match(/<a:p\b[\s\S]*?<\/a:p>/g) ?? [])
    .map((paragraph) => unxml((paragraph.match(/<a:t[^>]*>[\s\S]*?<\/a:t>/g) ?? []).map((run) => run.replace(/<[^>]+>/g, "")).join("")).trim())
    .filter(Boolean)
    .join("\n");
}

/** Slides and speaker notes in order, each with its slide number as the location. Slides that are only pictures have no text to read. */
async function readPresentation(bytes: Buffer): Promise<UploadReading> {
  const zip = await JSZip.loadAsync(bytes);
  const number = (path: string): number => Number(/(\d+)\.xml$/.exec(path)?.[1] ?? 0);
  const slides = Object.keys(zip.files).filter((path) => /^ppt\/slides\/slide\d+\.xml$/.test(path)).sort((a, b) => number(a) - number(b));
  const pieces: UploadPiece[] = [];
  for (const path of slides.slice(0, MAX_SLIDES)) {
    const n = number(path);
    pieces.push(...chunk(slideText(await zip.files[path].async("string")), `slide ${n}`));
    const notes = zip.files[`ppt/notesSlides/notesSlide${n}.xml`];
    if (notes) pieces.push(...chunk(slideText(await notes.async("string")), `slide ${n} notes`));
  }
  if (!pieces.length) return { status: "failed", pieces: [], note: "No readable text was found on the slides. If they are pictures, paste the text instead." };
  return { status: "extracted", pieces, note: slides.length > MAX_SLIDES ? `Read the first ${MAX_SLIDES} of ${slides.length} slides; the rest were left out.` : undefined };
}

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

/** Page text already read elsewhere (in the person's browser) becomes the same located pieces a server reading gives. */
export const MAX_PRE_READ_PAGES = 1500;
export const MAX_PRE_READ_CHARS = 3_000_000;

export function readingFromPages(pages: Array<{ num: number; text: string }>): UploadReading {
  const pieces = pages.flatMap((page) => chunk(page.text, `page ${page.num}`));
  return pieces.length
    ? { status: "extracted", pieces }
    : { status: "failed", pieces: [], note: "This PDF has no text in it: its pages are pictures (a scan, or slides saved as images). Paste the text, or save the slides as a Word file, and add that instead." };
}

export async function readUpload(filename: string, bytes: Buffer): Promise<UploadReading> {
  const name = filename.toLowerCase();
  try {
    if (name.endsWith(".pdf")) {
      // Loaded only when a PDF arrives: if the PDF reader cannot start on the server, other files and pasted text still work.
      let PDFParse: typeof import("pdf-parse").PDFParse;
      try {
        ({ PDFParse } = await import("pdf-parse"));
      } catch (error) {
        console.warn("[capture] the PDF reader could not start:", error instanceof Error ? error.message : error);
        return { status: "failed", pieces: [], note: "PDF files cannot be read on this server yet. Save the PDF as a Word or text file, or paste its text, and add that instead." };
      }
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
      const mammoth = (await import("mammoth")).default;
      const text = (await mammoth.extractRawText({ buffer: bytes })).value;
      const pieces = chunk(text, "document");
      return pieces.length ? { status: "extracted", pieces } : { status: "failed", pieces: [], note: "The document has no readable text." };
    }
    if (name.endsWith(".pptx")) return await readPresentation(bytes);
    if (IMAGE_EXTENSIONS.some((ext) => name.endsWith(ext))) {
      if (bytes.byteLength > MAX_IMAGE_BYTES) return { status: "failed", pieces: [], note: "That picture is larger than 20 MB. Save a smaller copy and add that." };
      const text = await transcribeImage(bytes, filename);
      const pieces = chunk(text, "image");
      return pieces.length ? { status: "extracted", pieces, note: "Text read from a picture by AI: check it against the original." } : { status: "failed", pieces: [], note: "No readable text was found in this picture. If it is a photo of a page, retake it flat and in good light." };
    }
    if (name.endsWith(".txt") || name.endsWith(".md")) {
      const pieces = chunk(bytes.toString("utf8"), "document");
      return pieces.length ? { status: "extracted", pieces } : { status: "failed", pieces: [], note: "The file is empty." };
    }
    if (name.endsWith(".csv") || name.endsWith(".xlsx") || name.endsWith(".xls")) {
      const workbook = XLSX.read(bytes, { type: "buffer", cellFormula: false, cellHTML: false });
      const pieces: UploadPiece[] = [];
      const skipped: string[] = [];
      if (workbook.SheetNames.length > 8) skipped.push(`${workbook.SheetNames.length - 8} sheet(s) after the first 8`);
      for (const sheetName of workbook.SheetNames.slice(0, 8)) {
        const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], { header: 1, blankrows: false, defval: "" }) as unknown[][];
        if (rows.length > 400) skipped.push(`${rows.length - 400} row(s) of sheet "${sheetName}" after row 400`);
        for (let start = 0; start < rows.length && start < 400; start += 40) {
          const slice = rows.slice(start, start + 40);
          pieces.push(...chunk(slice.map((row) => row.map((cell) => String(cell ?? "")).join(" | ")).join("\n"), `sheet "${sheetName}", rows ${start + 1}-${start + slice.length}`));
        }
      }
      return pieces.length ? { status: "extracted", pieces, note: skipped.length ? `Not read: ${skipped.join("; ")}.` : undefined } : { status: "failed", pieces: [], note: "The spreadsheet has no readable cells." };
    }
    return { status: "unsupported", pieces: [], note: "This file type is stored for the record but not read yet. Supported: PDF, Word (.docx), PowerPoint (.pptx), pictures, text, CSV and Excel." };
  } catch (error) {
    if (error instanceof MediaServiceError) return { status: "failed", pieces: [], note: error.message };
    console.warn("[capture] upload could not be read:", error instanceof Error ? error.message : error);
    return { status: "failed", pieces: [], note: "The file could not be read. Try another copy of it." };
  }
}
