import { fitMarked } from "../capture/budget";
import { SECTIONS, type KnowledgePackage, type PackageItem, type SectionId } from "../capture/knowledge-package";
import { suggestSkills } from "../pathway/skill-map";
import type { SkillShotBrief } from "./scaffold";

/**
 * Turns a contributor's APPROVED knowledge package into pieces that are each worth one Skill Shot, and each piece into a brief for the
 * design agent. The package already holds only statements the contributor confirmed and cleared for sharing, so nothing private or
 * unreviewed can reach a Skill Shot from here. Grouping is by what the statements are about (a process, a tool, a measure, a mistake),
 * a few statements to a piece, so each piece teaches one thing. The design agent adds structure and a check but no new facts.
 */

/** About the person or the package itself, not teachable content. */
const NOT_TEACHABLE: ReadonlySet<SectionId> = new Set(["overview", "expertise", "paths", "open", "sources"]);

/** A piece needs this many statements to be worth teaching from, and takes at most this many before a second piece starts. */
export const MIN_STATEMENTS = 2;
export const MAX_STATEMENTS = 7;

export type Piece = {
  /** Stable for the same package: the draft's address and how a later run knows it was already made. */
  key: string;
  section: SectionId;
  sectionTitle: string;
  title: string;
  items: PackageItem[];
};

export type PiecePlan = { pieces: Piece[]; leftOut: string[] };

const SHORT: Partial<Record<SectionId, string>> = {
  industry: "How the industry works", factors: "What drives the business", functions: "How the functions work together", processes: "How the work flows",
  roles: "What the role involves", skills: "The skills the work needs", kpis: "How performance is measured", practices: "What good looks like",
  howto: "How to do it, step by step", tools: "The tools and templates", cases: "A real case", mistakes: "Mistakes to avoid and how", leadership: "Leading well", training: "Getting ready for the work",
};

export function planPieces(pkg: Pick<KnowledgePackage, "sections">, projectTitle: string, tag: string): PiecePlan {
  const pieces: Piece[] = [];
  const leftOut: string[] = [];
  for (const section of pkg.sections) {
    if (NOT_TEACHABLE.has(section.id) || !section.items.length) continue;
    if (section.items.length < MIN_STATEMENTS) {
      leftOut.push(`${SECTIONS.find((item) => item.id === section.id)?.title ?? section.title}: only ${section.items.length} statement, too little to teach from on its own`);
      continue;
    }
    // Even parts, so a section of 8 becomes 4 + 4, not 7 + 1.
    const parts = Math.ceil(section.items.length / MAX_STATEMENTS);
    const size = Math.ceil(section.items.length / parts);
    for (let part = 0; part < parts; part += 1) {
      const items = section.items.slice(part * size, (part + 1) * size);
      if (items.length < MIN_STATEMENTS) continue;
      const base = SHORT[section.id] ?? section.title;
      pieces.push({ key: `pkg-${tag}-${section.id}${parts > 1 ? `-${part + 1}` : ""}`, section: section.id, sectionTitle: section.title, title: `${base}: ${projectTitle}${parts > 1 ? ` (part ${part + 1})` : ""}`.slice(0, 160), items });
    }
  }
  return { pieces, leftOut };
}

/** One piece as a brief. The statements are the source, in the contributor's cleared words, each with where it came from. */
export function pieceBrief(piece: Piece, input: { contributor: string; projectId: string; audience?: string }): SkillShotBrief & { sourceProjectId: string } {
  const lines = piece.items.map((item, index) => `${index + 1}. ${item.title}: ${item.text}${item.refs.length ? ` [source ${item.refs.slice(0, 3).join(", ")}]` : ""}`);
  const notes = fitMarked([`Confirmed statements from ${input.contributor} about "${piece.sectionTitle}". Teach only from these, in plain words; add no new facts.`, ...lines].join("\n"), 24000);
  const skills = suggestSkills({ title: piece.title, objective: "", coreConcept: piece.items.map((item) => `${item.title} ${item.text}`).join(" "), narration: [], proficiency: "working" }, 3).map(({ skill, toLevel }) => ({ skill, toLevel }));
  const fromInterview = piece.items.some((item) => item.refs.some((ref) => /^[SC]\d/.test(ref)));
  return {
    topic: piece.title.length >= 4 ? piece.title : `${piece.title} lesson`,
    slug: piece.key,
    skills: skills.length ? skills : [{ skill: "communication", toLevel: 2 }],
    audience: input.audience?.trim() || "New joiners and working professionals",
    proficiency: "working",
    sourceKind: fromInterview ? "expert-interview" : "document",
    contributor: input.contributor,
    sourceNotes: notes,
    sourceProjectId: input.projectId,
  };
}
