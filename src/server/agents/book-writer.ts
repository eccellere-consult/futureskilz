import { z } from "zod";

import { BOOK_STRUCTURE, CRAFT_RULES, FACT_RULE } from "../../features/book/craft";
import { groupAnswers, outlineBook } from "../../features/book/outline";
import { bookSchema, chapterSchema, sectionSchema, wordCount, type Book, type BookChapter, type SourceAnswer } from "../../features/book/types";
import type { AiProvider } from "../providers/ai";
import type { AgentDefinition } from "./registry";

/**
 * Book Writer Agent. Turns an interview into a short business book of three to five chapters, using the working rules of strong
 * business writing (story first, one idea per chapter, a named method, takeaways, a thing to try). It writes the frame (title,
 * introduction, conclusion, back cover, KDP details) in one step and each chapter in its own step, so one weak reply costs one
 * part, not the book. Every part that fails falls back to the author's own words, tidied, so a book always results.
 * The author did not have each sentence checked, so the book carries a disclosure and the author approves it before it is shared.
 */
export const bookInputSchema = z.object({
  author: z.string().trim().min(2).max(120),
  headline: z.string().trim().max(200).nullish(),
  answers: z.array(z.object({ key: z.string(), phase: z.string(), question: z.string(), answer: z.string(), role: z.string().optional() })).min(1).max(200),
});
export type BookInput = z.infer<typeof bookInputSchema>;
export type BookOutput = { book: Book; source: "ai" | "outline"; notes: string[] };

const RULES = `Craft rules:\n- ${CRAFT_RULES.join("\n- ")}\n\nBook structure:\n- ${BOOK_STRUCTURE.join("\n- ")}\n\nFact rule: ${FACT_RULE}\nWhere an answer is marked as a correction the author made while checking the interview, it takes precedence over any earlier answer that says otherwise.\nWrite in first person as the author, in plain, warm, confident English (India). No flattery, no clichés, no filler. Reply with ONE JSON object only.`;

const FRAME_SYSTEM = `You are an editor who shapes an experienced professional's interview into a short business book, in the manner of the best business writers. ${RULES}
Return {"title","subtitle","tagline","audience","bigIdea","dedication","introduction":{"title","sections":[{"heading?","paragraphs":[]}]},"conclusion":{"title","sections":[...]},"aboutAuthor":[],"backCover":{"hook","bullets":[3 or 4],"blurb","authorBio","quote?"},"kdp":{"description","keywords":[5 to 7],"categories":[1 to 3],"language":"English"},"chapterTitles":[{"title","subtitle"}]}.
The title is short and memorable; the subtitle promises a specific benefit to a specific reader. The introduction opens with a concrete moment from the source, names the reader's problem, states the one big idea and says what the reader will be able to do. The conclusion returns to that moment and ends with one action for Monday. Give each chapter a title and subtitle in the same order as the chapter outline you are given.`;

const CHAPTER_SYSTEM = `You are an editor writing ONE chapter of a short business book from an author's interview answers. ${RULES}
Return {"number","title","subtitle","epigraph?":{"text","by?"},"sections":[{"heading?","paragraphs":[],"pullQuote?"}],"takeaways":[3],"tryThis"}. Open inside a concrete scene from the answers. Give the chapter one idea, a named method of three to five steps when the author described how they work, and one pull quote in the author's own words. Write 700 to 1100 words. End with a bridge sentence to the next chapter unless it is the last.`;

const parseJson = (content: string): unknown => {
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("No JSON in the reply.");
  return JSON.parse(content.slice(start, end + 1));
};

const frameSchema = z.object({
  title: z.string().min(2).max(120), subtitle: z.string().min(2).max(200), tagline: z.string().max(160), audience: z.string().max(240), bigIdea: z.string().max(400),
  dedication: z.string().max(240).default(""),
  introduction: bookSchema.shape.introduction, conclusion: bookSchema.shape.conclusion, aboutAuthor: bookSchema.shape.aboutAuthor,
  backCover: bookSchema.shape.backCover, kdp: bookSchema.shape.kdp,
  chapterTitles: z.array(z.object({ title: z.string().max(120), subtitle: z.string().max(200).optional() })).default([]),
});

const digest = (items: SourceAnswer[]) => items.map((item) => `Q: ${item.question}${item.role ? ` (about the role: ${item.role})` : ""}\nA: ${item.answer}`).join("\n\n").slice(0, 9000);

export function createBookWriterAgent(ai: AiProvider): AgentDefinition<BookInput, BookOutput> {
  return {
    name: "book-writer",
    version: "1",
    inputSchema: bookInputSchema as unknown as z.ZodType<BookInput>,
    outputSchema: z.custom<BookOutput>(),
    costCeilingMicros: 600_000,
    requiresApproval: true,
    async execute(input) {
      const base = outlineBook({ author: input.author, headline: input.headline, answers: input.answers });
      if (ai.name === "deterministic") return { book: base, source: "outline", notes: ["No AI is configured, so this book uses the author's own words, tidied, in order."] };

      const groups = groupAnswers(input.answers);
      const notes: string[] = [];
      let aiParts = 0;
      const ask = async (system: string, user: string, tokens: number) => {
        const response = await ai.generate({ temperature: 0.7, maxOutputTokens: tokens, messages: [{ role: "system", content: system }, { role: "user", content: user }] });
        return parseJson(response.content);
      };

      // Frame: title, introduction, conclusion, back cover and KDP details.
      let frame: z.infer<typeof frameSchema> | null = null;
      try {
        const outline = groups.map((group, index) => `Chapter ${index + 1} (${group.chapter.title}): ${group.items.map((item) => item.answer.slice(0, 160)).join(" | ")}`).join("\n");
        const parsed = frameSchema.safeParse(await ask(FRAME_SYSTEM, `Author: ${input.author}${input.headline ? `, ${input.headline}` : ""}\n\nChapter outline:\n${outline}\n\nKey answers:\n${digest(input.answers.filter((item) => ["o.journey", "o.book_idea", "o.book_title", "a.topics", "a.teach"].includes(item.key)))}`, 4500));
        if (parsed.success) { frame = parsed.data; aiParts += 1; } else notes.push("The introduction and back cover used the plain version: the AI reply did not fit the format.");
      } catch { notes.push("The introduction and back cover used the plain version: the AI service did not answer."); }

      // Chapters, one at a time, each falling back on its own.
      const chapters: BookChapter[] = [];
      for (let index = 0; index < groups.length; index += 1) {
        const group = groups[index];
        const fallback = base.chapters[index];
        try {
          const titles = frame?.chapterTitles[index];
          const user = `Author: ${input.author}\nChapter ${index + 1} of ${groups.length}. Working title: ${titles?.title ?? group.chapter.title}. Theme: ${group.chapter.subtitle}.\n${index < groups.length - 1 ? `Next chapter: ${groups[index + 1].chapter.title}.` : "This is the last chapter."}\n\nThe author's answers:\n${digest(group.items)}`;
          const raw = (await ask(CHAPTER_SYSTEM, user, 3500)) as Record<string, unknown>;
          const parsed = chapterSchema.safeParse({ ...raw, number: index + 1 });
          const words = parsed.success ? parsed.data.sections.reduce((n, s) => n + s.paragraphs.reduce((m, p) => m + wordCount(p), 0), 0) : 0;
          if (parsed.success && words >= 250) { chapters.push({ ...parsed.data, title: parsed.data.title || fallback.title }); aiParts += 1; continue; }
          notes.push(`Chapter ${index + 1} used the author's own words: the AI draft was ${parsed.success ? "too short" : "not in the right format"}.`);
        } catch { notes.push(`Chapter ${index + 1} used the author's own words: the AI service did not answer.`); }
        chapters.push(fallback);
      }

      const merged: Book = {
        ...base,
        ...(frame ? { title: frame.title, subtitle: frame.subtitle, tagline: frame.tagline, audience: frame.audience, bigIdea: frame.bigIdea, dedication: frame.dedication || base.dedication, introduction: frame.introduction, conclusion: frame.conclusion, aboutAuthor: frame.aboutAuthor, backCover: frame.backCover, kdp: frame.kdp } : {}),
        author: input.author,
        chapters,
        source: aiParts > 0 ? "ai" : "outline",
      };
      const checked = bookSchema.safeParse(merged);
      if (!checked.success) return { book: base, source: "outline", notes: [...notes, "The combined draft did not pass the format check, so the plain version was kept."] };
      return { book: checked.data, source: checked.data.source, notes };
    },
  };
}

export const chapterRequestSchema = z.object({
  author: z.string().min(2).max(120),
  answers: bookInputSchema.shape.answers,
  book: z.custom<Book>(),
  number: z.number().int().min(1).max(5),
  instruction: z.string().trim().min(4).max(600),
});
export type ChapterRequest = z.infer<typeof chapterRequestSchema>;

const REQUEST_SYSTEM = `You are an editor rewriting ONE chapter of a short business book at the request of the author, an editor or an admin. ${RULES}
Follow the requester's instruction, but keep every fact in the author's answers and add none. Return the same JSON shape as a chapter: {"number","title","subtitle","epigraph?":{"text","by?"},"sections":[{"heading?","paragraphs":[],"pullQuote?"}],"takeaways":[3],"tryThis"}. Write 700 to 1100 words unless the instruction asks for another length.`;

/** Writer on request: rewrites one chapter following an instruction. Fails (and the book stays as it was) if the reply is unusable. */
export function createChapterWriterAgent(ai: AiProvider): AgentDefinition<ChapterRequest, { chapter: BookChapter; note: string | null }> {
  return {
    name: "book-chapter-writer",
    version: "1",
    inputSchema: chapterRequestSchema as unknown as z.ZodType<ChapterRequest>,
    outputSchema: z.custom<{ chapter: BookChapter; note: string | null }>(),
    costCeilingMicros: 120_000,
    requiresApproval: true,
    async execute(input) {
      if (ai.name === "deterministic") throw new Error("No AI configured.");
      const group = groupAnswers(input.answers)[input.number - 1];
      const current = input.book.chapters.find((chapter) => chapter.number === input.number);
      if (!group || !current) throw new Error("Chapter not found.");
      const user = `Author: ${input.author}\nBook: ${input.book.title}. Chapter ${input.number} of ${input.book.chapters.length}: ${current.title}.\n\nInstruction: ${input.instruction}\n\nThe current chapter:\n${current.sections.flatMap((s) => s.paragraphs).join("\n").slice(0, 6000)}\n\nThe author's answers:\n${digest(group.items)}`;
      const response = await ai.generate({ temperature: 0.7, maxOutputTokens: 3500, messages: [{ role: "system", content: REQUEST_SYSTEM }, { role: "user", content: user }] });
      const parsed = chapterSchema.safeParse({ ...(parseJson(response.content) as Record<string, unknown>), number: input.number });
      if (!parsed.success) throw new Error("The reply did not fit the chapter format.");
      return { chapter: parsed.data, note: `Chapter ${input.number} was rewritten on request: ${input.instruction}` };
    },
  };
}

export { sectionSchema };
