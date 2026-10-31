import { z } from "zod";

/**
 * A book written from an interview: three to five chapters in the author's own voice, with a front cover, a back cover and the
 * details KDP asks for. The same chapters feed the training Skill Shots, so the book and the lessons say the same things.
 */
const text = (max: number) => z.string().max(max);
const paragraphs = z.array(text(2600)).min(1).max(40);

export const sectionSchema = z.object({ heading: text(120).optional(), paragraphs, pullQuote: text(260).optional() });
export const chapterSchema = z.object({
  number: z.number().int().min(1).max(9),
  title: text(120),
  subtitle: text(200).optional(),
  epigraph: z.object({ text: text(300), by: text(120).optional() }).optional(),
  sections: z.array(sectionSchema).min(1).max(12),
  takeaways: z.array(text(240)).min(2).max(5),
  tryThis: text(700),
});
export const bookSchema = z.object({
  title: text(120),
  subtitle: text(200),
  author: text(120),
  tagline: text(160),
  audience: text(240),
  bigIdea: text(400),
  dedication: text(240),
  introduction: z.object({ title: text(80), sections: z.array(sectionSchema).min(1).max(8) }),
  chapters: z.array(chapterSchema).min(3).max(5),
  conclusion: z.object({ title: text(80), sections: z.array(sectionSchema).min(1).max(8) }),
  aboutAuthor: z.array(text(1200)).min(1).max(4),
  backCover: z.object({ hook: text(220), bullets: z.array(text(160)).min(3).max(4), blurb: text(900), authorBio: text(420), quote: text(220).optional() }),
  kdp: z.object({ description: text(4000), keywords: z.array(text(50)).min(3).max(7), categories: z.array(text(120)).min(1).max(3), language: text(40) }),
  disclosure: text(900),
  generatedAt: text(40),
  source: z.enum(["ai", "outline"]),
});

export type BookSection = z.infer<typeof sectionSchema>;
export type BookChapter = z.infer<typeof chapterSchema>;
export type Book = z.infer<typeof bookSchema>;

/** One answer from the interview, with the question that drew it out. The raw material for a book. */
export type SourceAnswer = { key: string; phase: string; question: string; answer: string; role?: string };

/** Trial setting. The server reads BOOK_MIN_WORDS (default 100); raise it to 2000 or more for the final. */
export const DEFAULT_MIN_WORDS_FOR_BOOK = 100;
export const wordCount = (value: string): number => (value.trim() ? value.trim().split(/\s+/).length : 0);
