import { fitMarked } from "../capture/budget";
import { suggestSkills } from "../pathway/skill-map";
import { frameworkNote, pickFramework } from "./framework-lens";
import { DIRECT_TEACHING_RULE, LESSON_STANDARD } from "./lesson-standard";
import { cutEvenly, joinSmallSections, outlineMaterial } from "./outline";
import type { SkillShotBrief } from "./scaffold";

/**
 * The direct route for the pilot: Skill Shots made straight from the text of whatever was uploaded or said, with no confirm, package
 * or approval step in between.
 *
 * The course follows the material. Where the material has chapters or sections, each becomes one lesson, in the same order and under
 * the same name; a long section becomes two or three lessons and a thin one joins its neighbour. Only where the material has no
 * headings at all is it cut by size. Each lesson's brief tells the design agent to teach that section fully, in the material's own
 * order, to the adult-learning standard, and never to talk about "the document".
 */

/** Below this there is nothing to teach from. */
export const MIN_MATERIAL_CHARS = 200;
/** One lesson's text: enough for a full Skill Shot, small enough for the design agent to read whole. */
export const PART_CHARS = 9000;
/** A safety stop for one project, far above any real course. */
export const MAX_LESSONS = 120;

export type MaterialPart = {
  index: number;
  of: number;
  /** The section's own name, or nothing when the material had no headings. */
  title?: string;
  /** The chapter or module the section sits under. */
  group?: string;
  /** True when the lesson follows a section of the material; false when the text was only cut by size. */
  structured: boolean;
  previous?: string;
  next?: string;
  text: string;
};

/** Cuts text with no headings into parts of a readable size, on paragraph ends where it can. */
function cutBySize(clean: string): string[] {
  const parts: string[] = [];
  let start = 0;
  while (start < clean.length && parts.length < MAX_LESSONS) {
    let end = Math.min(clean.length, start + PART_CHARS);
    if (end < clean.length) {
      const boundary = clean.lastIndexOf("\n", end);
      if (boundary > start + PART_CHARS / 2) end = boundary;
    }
    const piece = clean.slice(start, end).trim();
    // A short tail joins the part before it instead of becoming a thin lesson of its own.
    if (piece.length < MIN_MATERIAL_CHARS && parts.length) parts[parts.length - 1] = `${parts[parts.length - 1]}\n${piece}`;
    else if (piece) parts.push(piece);
    start = end;
  }
  return parts;
}

/** The whole course the material gives, lesson by lesson, in the material's own order. */
export function planMaterial(text: string): MaterialPart[] {
  const clean = text.replace(/\r/g, "").trim();
  if (clean.length < MIN_MATERIAL_CHARS) return [];
  const sections = joinSmallSections(outlineMaterial(clean));
  const lessons: Array<Omit<MaterialPart, "index" | "of" | "previous" | "next">> = [];
  if (sections.length >= 2) {
    for (const section of sections) {
      const pieces = cutEvenly(section.text, Math.ceil(section.text.length / PART_CHARS));
      pieces.forEach((piece, at) => lessons.push({ title: pieces.length > 1 ? `${section.title} (${at + 1} of ${pieces.length})` : section.title, group: section.group, structured: true, text: piece }));
    }
  } else {
    for (const piece of cutBySize(clean)) lessons.push({ structured: false, text: piece });
  }
  const kept = lessons.slice(0, MAX_LESSONS);
  return kept.map((lesson, at) => ({ ...lesson, index: at + 1, of: kept.length, previous: kept[at - 1]?.title, next: kept[at + 1]?.title }));
}

/** Kept for callers that only want the first few parts. */
export function splitMaterial(text: string, limit: number): MaterialPart[] {
  return planMaterial(text).slice(0, limit);
}

/** The address of a lesson's draft. Lessons that follow the material's sections have their own series, so an older by-size series is never mistaken for them. */
export function materialSlug(part: MaterialPart, tag: string): string {
  return part.structured ? `doc-${tag}-s${part.index}` : `doc-${tag}-${part.index}`;
}

export function materialBrief(part: MaterialPart, input: { title: string; contributor: string; projectId: string; tag: string; audience?: string }): SkillShotBrief & { slug: string } {
  const course = input.title.trim().length >= 4 ? input.title.trim() : `${input.title.trim()} lesson`;
  const topic = (part.title ? `${part.group ? `${part.group}: ` : ""}${part.title}` : `${course}${part.of > 1 ? ` (part ${part.index} of ${part.of})` : ""}`).slice(0, 160);
  const framework = pickFramework("overview", part.text);
  const skills = suggestSkills({ title: topic, objective: "", coreConcept: part.text.slice(0, 4000), narration: [], proficiency: "working" }, 3).map(({ skill, toLevel }) => ({ skill, toLevel }));
  const place = [
    `This is lesson ${part.index} of ${part.of} in the course "${course}".`,
    part.title ? `It teaches the section "${part.title}"${part.group ? ` of "${part.group}"` : ""}. Title the lesson after that section.` : "Give the lesson a clear title of its own.",
    part.previous ? `The lesson before it is "${part.previous}": name it as the prerequisite and do not teach it again.` : "It is the first lesson: it needs no earlier lesson.",
    part.next ? `The lesson after it is "${part.next}": recommend it as what to learn next and do not teach it here.` : "It is the last lesson: close the course.",
  ].join(" ");
  const notes = fitMarked(
    [
      `${place}`,
      "FOLLOW THE MATERIAL: teach everything this section teaches, in the order the section presents it. Keep its own terms, headings, steps, models, examples, numbers and names. Do not pick one idea and drop the rest; do not reorder it; do not bring in content from outside it. If the section is already a lesson (it has objectives, an explanation, examples, an exercise), keep that structure and those activities. Use only facts that are in the section; where it is thin, teach less rather than invent.",
      DIRECT_TEACHING_RULE,
      `ADULT-LEARNING STANDARD: ${LESSON_STANDARD.join(" ")}`,
      ...(framework ? [frameworkNote(framework)] : []),
      "REFERENCE:",
      part.text,
    ].join("\n"),
    24000,
  );
  return {
    topic: topic.length >= 4 ? topic : `${topic} lesson`,
    slug: materialSlug(part, input.tag),
    skills: skills.length ? skills : [{ skill: "communication", toLevel: 2 }],
    audience: input.audience?.trim() || "New joiners and working professionals",
    proficiency: "working",
    sourceKind: "document",
    contributor: input.contributor,
    sourceNotes: notes,
    sourceProjectId: input.projectId,
    autopilot: true,
  };
}
