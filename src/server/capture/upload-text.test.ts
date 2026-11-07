import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { readingFromPages } from "./upload-text";

describe("PDF text read in the browser", () => {
  it("serves a helper script that is the same version as the installed PDF reader", () => {
    const normal = (file: string) => readFileSync(join(process.cwd(), file), "utf8").replace(/\r\n/g, "\n");
    expect(normal("public/pdf.worker.min.mjs")).toBe(normal("node_modules/pdfjs-dist/build/pdf.worker.min.mjs"));
  });

  it("becomes located pieces, one per page, keeping the page number as the source", () => {
    const reading = readingFromPages([{ num: 1, text: "Self awareness starts with noticing." }, { num: 3, text: "Ask for feedback each week." }]);
    expect(reading.status).toBe("extracted");
    expect(reading.pieces.map((piece) => piece.locator)).toEqual(["page 1", "page 3"]);
  });

  it("splits a long page into parts that keep the page number", () => {
    const reading = readingFromPages([{ num: 2, text: `${"A sentence about feedback. ".repeat(400)}` }]);
    expect(reading.pieces.length).toBeGreaterThan(1);
    expect(reading.pieces.every((piece) => piece.locator.startsWith("page 2, part "))).toBe(true);
  });

  it("says plainly when the pages are pictures with no text, instead of pretending it was read", () => {
    const reading = readingFromPages([{ num: 1, text: "   " }, { num: 2, text: "" }]);
    expect(reading.status).toBe("failed");
    expect(reading.note).toMatch(/pictures/);
  });
});
