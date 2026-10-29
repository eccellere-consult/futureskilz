import { describe, expect, it } from "vitest";

import type { AiProvider } from "../providers/ai";
import { createBookWriterAgent } from "./book-writer";

const long = (seed: string) => `${seed} We checked the figures every morning, then walked the floor and spoke to the shift lead about what the numbers meant that day.`;
const answers = ["A", "B", "F", "G", "K", "L", "O"].map((phase, i) => ({ key: `q${i}`, phase, question: `Question ${i}`, answer: long(`Story ${phase}.`) }));
const input = { author: "Ravi Menon", headline: "a production planner", answers };

const words = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(" ");
const chapterReply = JSON.stringify({ title: "A Better Title", sections: [{ paragraphs: [words(150), words(150), words(120)] }], takeaways: ["One thing.", "Another thing."], tryThis: "Try it." });
const frameReply = JSON.stringify({ title: "The Patient Planner", subtitle: "Forty years of getting things done", tagline: "Plain lessons", audience: "Newcomers", bigIdea: "Patience pays.", dedication: "For Asha.", introduction: { title: "Why", sections: [{ paragraphs: ["Opening scene."] }] }, conclusion: { title: "Monday", sections: [{ paragraphs: ["Do one thing."] }] }, aboutAuthor: ["Ravi is a planner."], backCover: { hook: "Hook.", bullets: ["a", "b", "c"], blurb: "Blurb.", authorBio: "Bio." }, kdp: { description: "D", keywords: ["a", "b", "c"], categories: ["Business"], language: "English" }, chapterTitles: [] });

const fake = (reply: (system: string) => string): AiProvider => ({ name: "openai", model: "test", async generate(request) { return { content: reply(request.messages[0].content), provider: "openai", model: "test", usage: { inputTokens: 0, outputTokens: 0, costMicros: 0 } }; } });

describe("book writer agent", () => {
  it("returns the author's own words with no AI configured", async () => {
    const out = await createBookWriterAgent({ name: "deterministic", model: "d", generate: async () => { throw new Error("no"); } }).execute(input, {} as never);
    expect(out.source).toBe("outline");
    expect(out.book.chapters.length).toBeGreaterThanOrEqual(3);
  });

  it("uses the AI frame and chapters when they are good", async () => {
    const out = await createBookWriterAgent(fake((system) => (system.includes("ONE chapter") ? chapterReply : frameReply))).execute(input, {} as never);
    expect(out.source).toBe("ai");
    expect(out.book.title).toBe("The Patient Planner");
    expect(out.book.chapters.every((c) => c.title === "A Better Title")).toBe(true);
    expect(out.book.disclosure).toMatch(/AI/);
  });

  it("falls back chapter by chapter when the AI replies badly", async () => {
    const out = await createBookWriterAgent(fake(() => "not json at all")).execute(input, {} as never);
    expect(out.source).toBe("outline");
    expect(out.notes.length).toBeGreaterThan(0);
    expect(out.book.chapters.length).toBeGreaterThanOrEqual(3);
  });

  it("keeps a short AI chapter out of the book", async () => {
    const short = JSON.stringify({ title: "Tiny", sections: [{ paragraphs: ["Too short."] }], takeaways: ["a", "b"], tryThis: "x" });
    const out = await createBookWriterAgent(fake((system) => (system.includes("ONE chapter") ? short : frameReply))).execute(input, {} as never);
    expect(out.book.chapters.some((c) => c.title === "Tiny")).toBe(false);
  });
});
