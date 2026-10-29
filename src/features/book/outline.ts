import { DISCLOSURE } from "./craft";
import { wordCount, type Book, type BookChapter, type SourceAnswer } from "./types";

/**
 * The book without an AI: the author's own answers, tidied and grouped into chapters by what they are about. It reads as the author
 * speaking, in order, with a proper front matter and back cover. An AI pass can then rewrite it into a stronger book, but this
 * always works, so the author is never left without a book to hold.
 */
const CHAPTERS: Array<{ title: string; subtitle: string; phases: string[]; tryThis: string }> = [
  { title: "Where It Began", subtitle: "The first job, and what nobody told me", phases: ["A", "B", "C"], tryThis: "Write down your first job, what you wished you had known on day one, and one person who helped you. Share it with someone who is just starting." },
  { title: "What the Work Taught Me", subtitle: "How things really get done", phases: ["D", "E", "F", "G", "H", "M"], tryThis: "Pick one task you do often. Write its steps as you really do them, then show them to a newcomer and ask what is unclear." },
  { title: "Turning Points", subtitle: "The moments that changed my mind", phases: ["K", "P", "I"], tryThis: "Think of a time something went wrong at work. Write what happened, what it cost, and the one thing you now do differently." },
  { title: "The People Who Shaped Me", subtitle: "Mentors, teams and the long view", phases: ["J", "L", "N"], tryThis: "Name someone who shaped how you work. Write them a short note saying what you learned from them, and send it." },
  { title: "What I Would Tell You", subtitle: "The advice I would give my younger self", phases: ["O"], tryThis: "Choose one piece of advice from this book and act on it before the end of the week. Tell someone you did." },
];

const FILLER = /\b(um+|uh+|you know|i mean|sort of|kind of)\b,?\s*/gi;

/** Tidies spoken words into readable ones: removes fillers, repairs spacing, and capitalises sentences. Keeps the author's wording. */
export function tidy(raw: string): string {
  const text = raw.replace(/\r/g, "").replace(FILLER, "").replace(/\s+/g, " ").replace(/\s+([,.;:!?])/g, "$1").replace(/,+([.!?])/g, "$1").replace(/\bi\b/g, "I").trim();
  return text.replace(/(^|[.!?]\s+)([a-z])/g, (_, lead: string, letter: string) => lead + letter.toUpperCase());
}

/** Splits long text into paragraphs of about this many words, at sentence ends. */
export function toParagraphs(text: string, target = 90): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+(?:["”’)])?|[^.!?]+$/g)?.map((sentence) => sentence.trim()).filter(Boolean) ?? [text];
  const out: string[] = [];
  let current: string[] = [];
  let words = 0;
  for (const sentence of sentences) {
    current.push(sentence);
    words += wordCount(sentence);
    if (words >= target) {
      out.push(current.join(" "));
      current = [];
      words = 0;
    }
  }
  if (current.length) out.push(current.join(" "));
  return out.filter((paragraph) => paragraph.length > 0);
}

const firstSentences = (text: string, n: number) => (text.match(/[^.!?]+[.!?]+/g) ?? [text]).slice(0, n).join(" ").trim();

export type OutlineInput = { author: string; headline?: string | null; answers: SourceAnswer[]; now?: string };

export type ChapterGroup = { chapter: (typeof CHAPTERS)[number]; items: SourceAnswer[] };

/** Groups the usable answers into three to five chapters by what they are about. */
/** The book questions asked at the end of the interview: where each belongs in the book, or null when it frames the whole book. */
const BOOK_KEY_PHASE: Record<string, string | null> = { "o.book_moment": "B", "o.book_mistake": "P", "o.book_method": "G", "o.book_idea": null, "o.book_title": null };

export function groupAnswers(answers: SourceAnswer[]): ChapterGroup[] {
  const usable = answers
    .filter((item) => BOOK_KEY_PHASE[item.key] !== null)
    .map((item) => ({ ...item, phase: BOOK_KEY_PHASE[item.key] ?? item.phase, answer: tidy(item.answer) }))
    .filter((item) => wordCount(item.answer) >= 8);
  let groups = CHAPTERS.map((chapter) => ({ chapter, items: usable.filter((item) => chapter.phases.includes(item.phase)) })).filter((group) => group.items.length > 0);
  // Fewer than three chapters of material: share what there is across three, in the order it was said.
  if (groups.length < 3 && usable.length >= 3) {
    const size = Math.ceil(usable.length / 3);
    groups = [0, 1, 2].map((index) => ({ chapter: CHAPTERS[[0, 1, 4][index]], items: usable.slice(index * size, (index + 1) * size) })).filter((group) => group.items.length > 0);
  }
  return groups.slice(0, 5);
}

export function outlineBook(input: OutlineInput): Book {
  const usable = input.answers.map((item) => ({ ...item, answer: tidy(item.answer) })).filter((item) => wordCount(item.answer) >= 8);
  const groups = groupAnswers(input.answers);
  const chapters: BookChapter[] = groups.map((group, index) => ({
    number: index + 1,
    title: group.chapter.title,
    subtitle: group.chapter.subtitle,
    sections: group.items.map((item) => ({ heading: item.key.startsWith("o.book") || item.key.startsWith("k.") ? undefined : sectionHeading(item), paragraphs: toParagraphs(item.answer) })),
    takeaways: takeawaysFor(group.items),
    tryThis: group.chapter.tryThis,
  }));

  const find = (key: string) => usable.find((item) => item.key === key)?.answer;
  const journey = find("o.journey") ?? usable[0]?.answer ?? "";
  const titleAnswer = input.answers.find((item) => item.key === "o.book_title")?.answer.trim();
  const bigIdea = find("o.book_idea");
  const author = input.author;
  const topics = find("a.topics");
  const keywords = [...new Set((topics ?? "").split(/[,;]| and /i).map((word) => word.trim().toLowerCase()).filter((word) => word.length >= 3 && word.length <= 40))].slice(0, 4);
  const title = titleFrom(titleAnswer) ?? `${author.split(" ")[0]}: A Working Life`;
  const subtitle = "What a lifetime of work taught me, for those who come next";
  const blurb = firstSentences(journey, 4) || `${author} looks back on a working life and shares what it taught.`;

  return {
    title,
    subtitle,
    author,
    tagline: `Lessons from a working life, in ${author.split(" ")[0]}'s own words.`,
    audience: "People starting out or moving up, who want the lessons of an experienced professional without waiting decades to learn them.",
    bigIdea: bigIdea ? firstSentences(bigIdea, 2) : "What a working life teaches is worth passing on.",
    dedication: "For those who come next.",
    introduction: { title: "Why I Am Telling You This", sections: [{ paragraphs: [`These pages come from conversations in which I looked back on my working life. I have kept my own words as far as I could, because this is how I would tell you in person.`, ...(journey ? toParagraphs(journey, 80).slice(0, 2) : [])] }] },
    chapters,
    conclusion: { title: "What to Do on Monday", sections: [{ paragraphs: [`If you take one thing from these pages, let it be this: ${bigIdea ? firstSentences(bigIdea, 1) : "learn from the people around you, and pass it on."}`, "Pick one idea. Try it this week. Then tell someone what happened."] }] },
    aboutAuthor: [input.headline ? `${author} is ${input.headline}.` : `${author} has spent a working life learning, doing and teaching.`, "This book grew out of a series of interviews. It is shared so that what one career learned can help the next."],
    backCover: {
      hook: firstSentences(find("o.book_idea") ?? journey, 1).slice(0, 200) || `A working life, and what it teaches.`,
      bullets: chapters.slice(0, 4).map((chapter) => `${chapter.title}: ${chapter.subtitle ?? ""}`.replace(/:\s*$/, "")).slice(0, 4).concat(["Practical things to try this week", "Told plainly, in the author's own voice"]).slice(0, 4),
      blurb,
      authorBio: `${author}${input.headline ? `, ${input.headline},` : ""} shares what a career has taught, so it can help someone starting theirs.`,
    },
    kdp: {
      description: `${blurb}\n\n${chapters.map((chapter) => `${chapter.title}: ${chapter.subtitle ?? ""}`).join("\n")}`.slice(0, 4000),
      keywords: [...keywords, "career advice", "business memoir", "lessons learned", "mentoring", "professional growth", "work experience", "leadership"].slice(0, 7),
      categories: ["Biographies & Memoirs > Professionals & Academics > Business", "Business & Money > Management & Leadership > Leadership", "Business & Money > Skills > Mentoring & Coaching"],
      language: "English",
    },
    disclosure: DISCLOSURE,
    generatedAt: input.now ?? new Date().toISOString(),
    source: "outline",
  };
}

function sectionHeading(item: SourceAnswer): string | undefined {
  if (item.key === "o.journey") return "In short";
  if (item.role) return item.role;
  return undefined;
}

function takeawaysFor(items: SourceAnswer[]): string[] {
  const lines = items.map((item) => firstSentences(item.answer, 1)).filter((line) => line.length >= 25 && line.length <= 220);
  const pick = lines.slice(0, 3);
  while (pick.length < 2) pick.push("Pay attention to what the people around you do well, and ask them how.");
  return pick;
}

/** The title out of a spoken answer such as "I would call it The Patient Planner, for people starting out". */
export function titleFrom(raw: string | undefined): string | null {
  if (!raw) return null;
  const quoted = /["“]([^"”]{3,70})["”]/.exec(raw)?.[1];
  const candidate = (quoted ?? raw.split(/[,.;—]| for | and who /i)[0]).replace(/^\s*(i would call it|i'd call it|i would name it|call it|it would be|maybe|perhaps)\s+/i, "").replace(/["“”]/g, "").trim();
  const words = wordCount(candidate);
  return words >= 1 && words <= 8 ? candidate.replace(/\b([a-z])/g, (m) => m.toUpperCase()) : null;
}
