/**
 * Finds the structure a document already has (its chapters, sections and headings) so a course made from it follows the same
 * order and the same names. Pure text work: no AI, so it is free, instant and the same every time.
 *
 * A heading is recognised from how it is written: a "#" title, a "Chapter 3" or "Module 2" line, a numbered title ("2.1 Listening"),
 * a line in capitals, or a short Title Case line standing on its own. Where a document has no headings at all, the caller falls back
 * to cutting by size.
 */

export type OutlineSection = {
  /** The heading as written, without its "#" or trailing colon. */
  title: string;
  /** The chapter or module this section sits under, when the document has two levels. */
  group?: string;
  text: string;
};

/** A section shorter than this cannot carry a full lesson, so it joins its neighbour. */
export const MIN_SECTION_CHARS = 1500;
/** A heading with less text than this under it is a chapter title for the sections that follow, not a lesson. */
const PARENT_BODY_CHARS = 200;

const KEYWORD = /^(chapter|module|unit|section|lesson|part|session|topic|step|week|day)\s+([0-9]{1,3}|[ivxlc]{1,6}|one|two|three|four|five|six|seven|eight|nine|ten)\b/i;
const NUMBERED = /^\d{1,2}(\.\d{1,2}){0,2}[.)]?\s+\p{Lu}/u;
const SMALL_WORDS = new Set(["a", "an", "and", "as", "at", "but", "by", "for", "from", "in", "is", "of", "on", "or", "the", "to", "vs", "with", "your"]);

function words(line: string): string[] {
  return line.split(/\s+/).filter(Boolean);
}

/** How sure we are that a line is a heading: 2 by the way it is written, 1 only if it also stands apart, 0 not a heading. */
function headingStrength(line: string): 0 | 1 | 2 {
  const text = line.trim();
  if (/^#{1,4}\s+\S/.test(text)) return 2;
  if (text.length < 3 || text.length > 90) return 0;
  const parts = words(text);
  if (parts.length > 12 || !/\p{L}{2}/u.test(text)) return 0;
  // A sentence, a list item or a table row is not a heading.
  if (/[.,;!]$/.test(text) || /^[-*•●▪]/.test(text) || text.includes(" | ")) return 0;
  if (KEYWORD.test(text)) return 2;
  if (NUMBERED.test(text) && parts.length <= 10) return 2;
  const letters = text.replace(/[^\p{L}]/gu, "");
  if (letters.length >= 6 && letters === letters.toUpperCase() && letters !== letters.toLowerCase()) return 2;
  if (parts.length < 2 || parts.length > 9 || !/^\p{Lu}/u.test(text)) return 0;
  const counted = parts.filter((word) => !SMALL_WORDS.has(word.toLowerCase()) && /\p{L}/u.test(word));
  const capitalised = counted.filter((word) => /^[("'“]?\p{Lu}/u.test(word));
  return counted.length >= 2 && capitalised.length / counted.length >= 0.75 ? 1 : 0;
}

export function cleanHeading(line: string): string {
  return line.trim().replace(/^#{1,4}\s+/, "").replace(/\s*[:–—-]\s*$/, "").replace(/\s+/g, " ").slice(0, 110);
}

/** A numbered list ("1. Do this, 2. Do that") looks like numbered headings; real headings have body text between them. */
function isRunOfListItems(lines: string[], at: number): boolean {
  const near = (index: number) => {
    for (let step = 1; step <= 2; step += 1) {
      const other = lines[index + step]?.trim();
      if (other && NUMBERED.test(other)) return true;
    }
    return false;
  };
  return near(at) || (at >= 1 && NUMBERED.test(lines[at - 1]?.trim() ?? "")) || (at >= 2 && NUMBERED.test(lines[at - 2]?.trim() ?? ""));
}

/**
 * The document's own sections, in order. Empty when it has fewer than two headings (then there is no structure to follow).
 * Text before the first heading is kept as an opening section named `opening`.
 */
export function outlineMaterial(source: string, opening = "Introduction"): OutlineSection[] {
  const lines = source.replace(/\r/g, "").split("\n");
  const marks: Array<{ line: number; title: string }> = [];
  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index];
    if (!raw.trim()) continue;
    let strength = headingStrength(raw);
    if (!strength) continue;
    const before = index === 0 || !lines[index - 1].trim();
    const after = lines.slice(index + 1, index + 4).find((line) => line.trim());
    if (!after) continue;
    // A keyword or capitals heading is trusted as written. A numbered one must not be a list item; a Title Case one must stand apart.
    if (strength === 2 && NUMBERED.test(raw.trim()) && !/^#/.test(raw.trim()) && !KEYWORD.test(raw.trim()) && isRunOfListItems(lines, index)) strength = 0;
    if (strength === 1 && !before) strength = 0;
    if (!strength) continue;
    const title = cleanHeading(raw);
    // The same heading repeated on every page (a running header) is not structure.
    if (marks.some((mark) => mark.title.toLowerCase() === title.toLowerCase())) continue;
    marks.push({ line: index, title });
  }
  if (marks.length < 2) return [];

  const raw: OutlineSection[] = [];
  const lead = lines.slice(0, marks[0].line).join("\n").trim();
  if (lead) raw.push({ title: opening, text: lead });
  marks.forEach((mark, index) => {
    const end = index + 1 < marks.length ? marks[index + 1].line : lines.length;
    raw.push({ title: mark.title, text: lines.slice(mark.line + 1, end).join("\n").trim() });
  });

  // A heading with almost nothing under it names the sections that follow (a chapter above its sections).
  const sections: OutlineSection[] = [];
  let group: string | undefined;
  let carried = "";
  for (let index = 0; index < raw.length; index += 1) {
    const section = raw[index];
    const isLast = index === raw.length - 1;
    if (section.text.length < PARENT_BODY_CHARS && !isLast) {
      group = section.title === opening ? group : section.title;
      if (section.text) carried = `${carried}${carried ? "\n" : ""}${section.text}`;
      continue;
    }
    sections.push({ title: section.title, group: group && group !== section.title ? group : undefined, text: `${carried ? `${carried}\n` : ""}${section.text}`.trim() });
    carried = "";
  }
  if (sections.length < 2) return [];
  // One name over every section is the document's own title, not a chapter: it adds nothing to a lesson's name.
  const everywhere = sections[0].group && sections.every((section) => section.group === sections[0].group);
  return everywhere ? sections.map((section) => ({ title: section.title, text: section.text })) : sections;
}

/** Small sections join the next one under the same chapter, so every lesson has enough to teach. Order is never changed. */
export function joinSmallSections(sections: OutlineSection[], minimum = MIN_SECTION_CHARS): OutlineSection[] {
  type Open = { first: string; last: string; count: number; group?: string; text: string };
  const named = (open: Open): OutlineSection => {
    const title = open.count === 1 ? open.first : open.count === 2 ? `${open.first} and ${open.last}` : `${open.first} to ${open.last}`;
    return { title: title.slice(0, 140), group: open.group, text: open.text };
  };
  const done: Open[] = [];
  for (const section of sections) {
    const previous = done[done.length - 1];
    // Still too thin, and under the same chapter: the next section joins it, heading and all.
    if (previous && previous.text.length < minimum && previous.group === section.group) {
      previous.text = `${previous.text}${String.fromCharCode(10, 10)}${section.title}${String.fromCharCode(10)}${section.text}`;
      previous.last = section.title;
      previous.count += 1;
    } else {
      done.push({ first: section.title, last: section.title, count: 1, group: section.group, text: section.text });
    }
  }
  // A thin tail joins the lesson before it instead of becoming a thin lesson of its own.
  const tail = done[done.length - 1];
  if (done.length > 1 && tail.text.length < minimum) {
    const before = done[done.length - 2];
    before.text = `${before.text}${String.fromCharCode(10, 10)}${tail.first}${String.fromCharCode(10)}${tail.text}`;
    done.pop();
  }
  return done.map(named);
}

/** Cuts one long text into `count` near-equal pieces on paragraph or line ends. */
export function cutEvenly(text: string, count: number): string[] {
  if (count <= 1) return [text];
  const pieces: string[] = [];
  let start = 0;
  for (let piece = 1; piece < count; piece += 1) {
    const target = start + Math.round((text.length - start) / (count - piece + 1));
    const window = Math.round((text.length / count) * 0.3);
    let end = text.lastIndexOf("\n\n", target + window);
    if (end < target - window) end = text.lastIndexOf("\n", target + window);
    if (end < target - window) end = text.lastIndexOf(". ", target + window) + 1;
    if (end <= start || end < target - window) end = target;
    pieces.push(text.slice(start, end).trim());
    start = end;
  }
  pieces.push(text.slice(start).trim());
  return pieces.filter(Boolean);
}
