import { fitMarked } from "../capture/budget";
import { suggestSkills } from "../pathway/skill-map";
import { frameworkNote, pickFramework } from "./framework-lens";
import type { SkillShotBrief } from "./scaffold";

/**
 * The direct route for the pilot: Skill Shots made straight from the text of whatever was uploaded or said, with no confirm, package
 * or approval step in between. The text is cut into a few parts of a readable size, and each part becomes one brief that tells the
 * design agent to build the best lesson it can from that reference, using only what the reference says.
 */

/** Below this there is nothing to teach from. */
export const MIN_MATERIAL_CHARS = 200;
/** One part: enough for a full Skill Shot, small enough for the design agent to read whole. */
export const PART_CHARS = 9000;

export type MaterialPart = { index: number; of: number; text: string };

/** Cuts the material into at most `limit` parts, on paragraph ends where it can. Text beyond the last part is left for the next run. */
export function splitMaterial(text: string, limit: number): MaterialPart[] {
  const clean = text.replace(/\r/g, "").trim();
  if (clean.length < MIN_MATERIAL_CHARS) return [];
  const parts: string[] = [];
  let start = 0;
  while (start < clean.length && parts.length < limit) {
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
  return parts.map((part, index) => ({ index: index + 1, of: parts.length, text: part }));
}

export function materialBrief(part: MaterialPart, input: { title: string; contributor: string; projectId: string; tag: string; audience?: string }): SkillShotBrief & { slug: string } {
  const title = input.title.trim().length >= 4 ? input.title.trim() : `${input.title.trim()} lesson`;
  const topic = `${title}${part.of > 1 ? ` (part ${part.index} of ${part.of})` : ""}`.slice(0, 160);
  const framework = pickFramework("overview", part.text);
  const skills = suggestSkills({ title: topic, objective: "", coreConcept: part.text.slice(0, 4000), narration: [], proficiency: "working" }, 3).map(({ skill, toLevel }) => ({ skill, toLevel }));
  const notes = fitMarked(
    [
      `Reference material supplied by ${input.contributor}. Build the best Skill Shot you can from it: choose the single most useful thing it teaches, explain it in plain words with one workplace example and one non-example, and end with a check the learner can do. Use only facts, numbers, names and steps that are in the reference; where the reference is thin, teach less rather than invent. Give the lesson a clear title of its own.`,
      ...(framework ? [frameworkNote(framework)] : []),
      "REFERENCE:",
      part.text,
    ].join("\n"),
    24000,
  );
  return {
    topic,
    slug: `doc-${input.tag}-${part.index}`,
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
