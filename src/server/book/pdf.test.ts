import { describe, expect, it } from "vitest";

import { outlineBook } from "@/features/book/outline";

import { coverSize } from "./kdp";
import { renderCover, renderInterior } from "./pdf";

const long = (seed: string) => Array.from({ length: 10 }, (_, i) => `${seed} Part ${i} describes what we did on the floor and why it mattered to the people there.`).join(" ");
const book = outlineBook({ author: "Ravi Menon", answers: ["A", "B", "F", "G", "K", "L", "O"].map((phase, i) => ({ key: `k${i}`, phase, question: "q", answer: long(`Story ${phase}.`) })) });

const pageCount = (pdf: Buffer) => Number(/\/Type \/Pages[\s\S]*?\/Count (\d+)/.exec(pdf.toString("latin1"))?.[1]);

describe("print-ready PDFs", () => {
  it("lays the interior out as an even number of pages, at least the KDP minimum", async () => {
    const { pdf, pages } = await renderInterior(book);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pages).toBeGreaterThanOrEqual(24);
    expect(pages % 2).toBe(0);
    expect(pageCount(pdf)).toBe(pages);
  });

  it("makes a one-page cover as wide as two trims, the spine and both bleeds", async () => {
    const { pages } = await renderInterior(book);
    const pdf = await renderCover(book, pages, null);
    const size = coverSize(pages);
    const box = /\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/.exec(pdf.toString("latin1"));
    expect(pageCount(pdf)).toBe(1);
    expect(Number(box?.[1])).toBeCloseTo(size.width * 72, 1);
    expect(Number(box?.[2])).toBeCloseTo(size.height * 72, 1);
  });
});
