import type { SkillShotBrief } from "../skillshot/scaffold";
import type { Book, BookChapter } from "./types";

/**
 * One chapter of an approved book, as a brief for the Skill Shot design agent. The chapter text is the source, so the training
 * says what the book says, in the author's own words. The agent adds structure, a decision and a check but no new facts.
 */
export function chapterBrief(book: Book, chapter: BookChapter, tag: string): SkillShotBrief {
  const text = chapter.sections.flatMap((section) => [section.heading ? `${section.heading}:` : "", ...section.paragraphs]).filter(Boolean).join("\n");
  const notes = [`The author's chapter "${chapter.title}" from the book "${book.title}", in their own words (${book.author}).`, text, `Takeaways: ${chapter.takeaways.join(" | ")}`, `Try this: ${chapter.tryThis}`].join("\n").slice(0, 8000);
  return {
    topic: chapter.title.length >= 4 ? chapter.title : `${chapter.title} lesson`,
    slug: `book-${tag}-ch${chapter.number}`,
    skills: [{ skill: "communication", toLevel: 2 }],
    audience: book.audience.slice(0, 300) || "People starting out or moving up",
    proficiency: "working",
    sourceKind: "expert-interview",
    contributor: book.author,
    sourceNotes: notes,
  };
}
