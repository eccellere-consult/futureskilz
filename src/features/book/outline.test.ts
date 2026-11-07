import { describe, expect, it } from "vitest";

import { bookSchema, type SourceAnswer } from "./types";
import { outlineBook, tidy, titleFrom, toParagraphs } from "./outline";

const answer = (key: string, phase: string, text: string, role?: string): SourceAnswer => ({ key, phase, question: `Q ${key}`, answer: text, role });
const long = (seed: string) => `${seed} We checked the figures every morning, then walked the floor, then spoke to the shift lead. It took years to see why it mattered. Um, you know, the quality kept improving because people felt heard.`;

const answers: SourceAnswer[] = [
  answer("a.teach", "A", long("I want newcomers to learn patience.")),
  answer("b.first_job", "B", long("I began in 1986 at a small plant outside Pune.")),
  answer("f.day", "F", long("My days started at six."), "Production Planner"),
  answer("g.steps", "G", long("The order release has five steps.")),
  answer("k.success", "K", long("The best day was when the line ran without a stop.")),
  answer("o.book_mistake", "O", long("I once released an order before checking capacity.")),
  answer("l.mentors", "L", long("Mr Iyer taught me to listen first.")),
  answer("o.journey", "O", long("Forty years across three plants.")),
  answer("o.book_title", "O", "I would call it The Patient Planner, for people starting out"),
];

describe("tidying spoken words", () => {
  it("removes fillers, fixes spacing and capitalises, keeping the wording", () => {
    expect(tidy("um so i began at  a plant , you know. it was loud")).toBe("So I began at a plant. It was loud");
  });
  it("splits long text into paragraphs at sentence ends", () => {
    const text = Array.from({ length: 12 }, (_, i) => `This is sentence number ${i} and it has about ten words in it.`).join(" ");
    const paragraphs = toParagraphs(text, 30);
    expect(paragraphs.length).toBeGreaterThan(2);
    for (const p of paragraphs) expect(p.endsWith(".")).toBe(true);
  });
});

describe("titles from speech", () => {
  it("takes the title out of a spoken answer", () => {
    expect(titleFrom('I would call it "The Patient Planner" for newcomers')).toBe("The Patient Planner");
    expect(titleFrom("I would call it Making Things Happen, for young managers")).toBe("Making Things Happen");
    expect(titleFrom("")).toBeNull();
  });
});

describe("the book without an AI", () => {
  const book = outlineBook({ author: "Ravi Menon", headline: "a production planner for forty years", answers, now: "2026-10-29T00:00:00Z" });

  it("is a valid book of three to five chapters", () => {
    expect(bookSchema.safeParse(book).success).toBe(true);
    expect(book.chapters.length).toBeGreaterThanOrEqual(3);
    expect(book.chapters.length).toBeLessThanOrEqual(5);
    expect(book.chapters.map((c) => c.number)).toEqual(book.chapters.map((_, i) => i + 1));
  });

  it("keeps the author's own words, tidied, and uses the title they gave", () => {
    const all = JSON.stringify(book.chapters);
    expect(all).toContain("released an order before checking capacity");
    expect(all).not.toMatch(/\bUm\b|you know/i);
    expect(book.title).toBe("The Patient Planner");
  });

  it("has front matter, a back cover with three or more promises, KDP details and an honest disclosure", () => {
    expect(book.backCover.bullets.length).toBeGreaterThanOrEqual(3);
    expect(book.kdp.keywords.length).toBeGreaterThanOrEqual(3);
    expect(book.kdp.keywords.length).toBeLessThanOrEqual(7);
    expect(book.disclosure).toMatch(/AI/);
    expect(book.disclosure).toMatch(/not been independently fact-checked/);
    expect(book.source).toBe("outline");
  });

  it("shares thin material across three chapters rather than making one", () => {
    const thin = outlineBook({ author: "A B", answers: [answer("b.first_job", "B", long("First.")), answer("f.day", "F", long("Second.")), answer("o.journey", "O", long("Third."))] });
    expect(thin.chapters.length).toBe(3);
  });
});
