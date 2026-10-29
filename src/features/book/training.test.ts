import { describe, expect, it } from "vitest";

import { briefSchema } from "../../server/agents/instructional-design";
import { outlineBook } from "./outline";
import { chapterBrief } from "./training";

describe("chapter briefs for training", () => {
  it("make a valid design brief from each chapter, with the author's words as the source", () => {
    const book = outlineBook({ author: "Ravi Menon", answers: ["A", "F", "O"].map((phase, i) => ({ key: `k${i}`, phase, question: "q", answer: `I learned that ${phase} matters because people notice when you do the small things right every day.` })) });
    for (const chapter of book.chapters) {
      const brief = chapterBrief(book, chapter, "abc12345");
      expect(briefSchema.safeParse(brief).success).toBe(true);
      expect(brief.sourceNotes).toContain("people notice");
      expect(brief.slug).toMatch(/^book-abc12345-ch\d$/);
    }
  });
});
