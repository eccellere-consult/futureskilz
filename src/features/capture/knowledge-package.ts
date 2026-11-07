import { labelOf } from "./question-bank";
import { yearsLabel } from "./timeline";
import type { CareerRole, Fact, FactCategory, Segment } from "./types";

/**
 * Assembles confirmed and proposed facts into the 19-section knowledge package (skill, Step 6). The same builder serves two
 * modes so a draft can never leak into a publication:
 * - draft: every fact the contributor has not rejected, each labelled with who said it and whether it is confirmed;
 * - publish: only facts the contributor confirmed or corrected AND allowed to be shared. Anonymised facts use the words the
 *   contributor approved; an anonymised fact with no approved wording is held back and reported.
 */

export type PackageMode = "draft" | "publish";

export type SectionId =
  | "overview" | "expertise" | "industry" | "factors" | "functions" | "processes" | "roles" | "skills" | "kpis" | "practices"
  | "howto" | "tools" | "cases" | "mistakes" | "leadership" | "training" | "paths" | "open" | "sources";

export const SECTIONS: Array<{ id: SectionId; number: number; title: string }> = [
  { id: "overview", number: 1, title: "Overview and scope" },
  { id: "expertise", number: 2, title: "Contributor expertise summary" },
  { id: "industry", number: 3, title: "Industry context and business model" },
  { id: "factors", number: 4, title: "Value chain and major industry factors" },
  { id: "functions", number: 5, title: "Organisation functions and interfaces" },
  { id: "processes", number: 6, title: "Process catalogue and workflows" },
  { id: "roles", number: 7, title: "Role catalogue and responsibilities" },
  { id: "skills", number: 8, title: "Skills and proficiency matrix" },
  { id: "kpis", number: 9, title: "KPIs and scorecards" },
  { id: "practices", number: 10, title: "Good practices and success factors" },
  { id: "howto", number: 11, title: "Step-by-step how-to guides" },
  { id: "tools", number: 12, title: "Tools, frameworks, templates and systems" },
  { id: "cases", number: 13, title: "Case studies and examples" },
  { id: "mistakes", number: 14, title: "Common mistakes, risks, controls and exceptions" },
  { id: "leadership", number: 15, title: "Leadership and high-performance behaviours" },
  { id: "training", number: 16, title: "Recommended training and resources" },
  { id: "paths", number: 17, title: "Proposed learning paths" },
  { id: "open", number: 18, title: "Open questions and limitations" },
  { id: "sources", number: 19, title: "Source map and review status" },
];

const BY_QUESTION: Record<string, SectionId> = {
  "a.teach": "overview", "a.topics": "overview", "a.limits": "overview",
  "b.first_job": "expertise", "b.prepare": "training", "b.day_one": "training", "b.on_the_job": "skills", "b.advice": "practices",
  "c.walk": "expertise", "c.title": "roles", "c.turning": "cases", "c.useful_today": "training", "c.transition": "expertise", "c.expertise_change": "skills",
  "d.explain": "industry", "d.players": "industry", "d.value": "factors", "d.change": "factors", "d.winners": "factors", "d.terms": "factors",
  "e.structure": "functions", "e.flow": "processes", "e.handoffs": "processes", "e.measures": "kpis", "e.collab": "leadership",
  "f.purpose": "roles", "f.duties": "roles", "f.rhythm": "roles", "f.decisions": "roles", "f.knowledge": "skills", "f.tools": "tools",
  "f.information": "processes", "f.failure": "mistakes", "f.excellent": "practices", "f.ramp": "training",
  "g.pick": "howto", "g.trigger": "howto", "g.steps": "howto", "g.tools": "howto", "g.quality": "howto", "g.signals": "howto", "g.exceptions": "howto", "g.example": "howto",
  "h.measured": "kpis", "h.kpis": "kpis", "h.cadence": "kpis", "h.leading": "kpis", "h.tradeoffs": "kpis", "h.gaming": "kpis", "h.strong": "practices",
  "i.who": "leadership", "i.judgement": "leadership", "i.practice": "training",
  "j.manage": "leadership", "j.conflict": "leadership", "j.first_manager": "leadership",
  "k.success": "cases", "k.challenge": "cases", "k.options": "cases", "k.evidence": "cases", "k.different": "cases", "k.share": "overview",
  "l.mentors": "leadership", "l.principle": "leadership",
  "m.notice": "practices", "m.warning": "mistakes", "m.judgement": "practices", "m.myths": "mistakes", "m.wish": "practices",
  "n.first": "training", "n.skills": "skills", "n.mistakes": "mistakes", "n.independent": "skills", "n.resources": "training",
  "o.journey": "expertise", "o.strengths": "expertise", "o.teach": "expertise", "o.materials": "overview", "o.missing": "open",
};

const BY_CATEGORY: Record<FactCategory, SectionId> = {
  career: "expertise", industry: "industry", function: "functions", process: "processes", role: "roles", kpi: "kpis", practice: "practices",
  tool: "tools", case: "cases", skill: "skills", tacit: "practices", mistake: "mistakes", leadership: "leadership", training: "training", permission: "overview",
};

export function sectionOf(fact: Pick<Fact, "category" | "details">): SectionId {
  const key = typeof fact.details?.questionKey === "string" ? fact.details.questionKey : null;
  return (key && BY_QUESTION[key]) || BY_CATEGORY[fact.category];
}

/** The words that may appear in a publication for this fact, or null when it must be withheld. */
export function publishableText(fact: Pick<Fact, "permission" | "statement" | "anonymizedStatement">): string | null {
  if (fact.permission === "public") return fact.statement;
  if (fact.permission === "anonymize") return fact.anonymizedStatement?.trim() ? fact.anonymizedStatement.trim() : null;
  return null;
}

export type SourceRef = { ref: string; segmentId: string; quote: string; origin: "interview" | "upload" | "correction"; locator?: string | null };

export type PackageItem = {
  factId: string;
  title: string;
  text: string;
  kind: Fact["kind"];
  reviewStatus: Fact["reviewStatus"];
  confidence: Fact["confidence"];
  roleId: string | null;
  processId: string | null;
  refs: string[];
  details?: Record<string, unknown> | null;
  anonymized: boolean;
};

export type KnowledgePackage = {
  mode: PackageMode;
  sections: Array<{ id: SectionId; number: number; title: string; items: PackageItem[] }>;
  sourceMap: SourceRef[];
  /** Facts left out of a publication and why. A draft leaves out only rejected facts. */
  withheld: Array<{ factId: string; title: string; reason: string }>;
  stats: { included: number; confirmed: number; unconfirmed: number; machineExtracted: number };
};

export function refLabel(segment: Segment): string {
  if (segment.source === "upload") return `U${segment.uploadId ? segment.uploadId.slice(0, 4) : ""}${segment.locator ? `:${segment.locator}` : ""}`.replace(/:$/, "");
  if (segment.source === "correction") return `C${segment.seq}`;
  return `S${segment.seq}`;
}

export function buildKnowledgePackage(input: { facts: Fact[]; segments: Segment[]; mode: PackageMode }): KnowledgePackage {
  const segmentById = new Map(input.segments.map((segment) => [segment.id, segment]));
  const sourceMap = new Map<string, SourceRef>();
  const withheld: KnowledgePackage["withheld"] = [];
  const sections = SECTIONS.map((section) => ({ ...section, items: [] as PackageItem[] }));
  const sectionIndex = new Map(sections.map((section) => [section.id, section]));
  let included = 0;
  let confirmed = 0;
  let machine = 0;

  for (const fact of input.facts) {
    if (fact.reviewStatus === "rejected") {
      withheld.push({ factId: fact.id, title: fact.title, reason: "Rejected by the contributor." });
      continue;
    }
    const isConfirmed = fact.reviewStatus === "confirmed" || fact.reviewStatus === "corrected";
    let text = fact.statement;
    let anonymized = false;
    if (input.mode === "publish") {
      if (!isConfirmed) {
        withheld.push({ factId: fact.id, title: fact.title, reason: "Not yet confirmed by the contributor." });
        continue;
      }
      if (fact.sensitivity !== "none" && fact.permission === "unset") {
        withheld.push({ factId: fact.id, title: fact.title, reason: "Flagged as possibly sensitive; the contributor has not chosen how to share it." });
        continue;
      }
      const allowed = publishableText(fact);
      if (allowed === null) {
        withheld.push({
          factId: fact.id,
          title: fact.title,
          reason: fact.permission === "anonymize" ? "Marked to anonymise, but no anonymised wording is approved yet." : fact.permission === "private" ? "Kept private by the contributor." : "The contributor has not allowed sharing.",
        });
        continue;
      }
      text = allowed;
      anonymized = fact.permission === "anonymize";
    }

    const refs: string[] = [];
    if (!anonymized) {
      for (const source of fact.sources) {
        const segment = segmentById.get(source.segmentId);
        if (!segment) continue;
        const ref = refLabel(segment);
        refs.push(ref);
        if (!sourceMap.has(ref)) sourceMap.set(ref, { ref, segmentId: segment.id, quote: source.quote, origin: segment.source, locator: segment.locator });
      }
    } else {
      // Anonymised wording must not carry the original quote into a publication; only the fact's existence is traceable.
      for (const source of fact.sources) {
        const segment = segmentById.get(source.segmentId);
        if (segment) refs.push(refLabel(segment));
      }
    }

    const section = sectionIndex.get(sectionOf(fact))!;
    section.items.push({
      factId: fact.id,
      title: fact.title,
      text,
      kind: fact.kind,
      reviewStatus: fact.reviewStatus,
      confidence: fact.confidence,
      roleId: fact.roleId ?? null,
      processId: fact.processId ?? null,
      refs: Array.from(new Set(refs)),
      details: fact.details ?? null,
      anonymized,
    });
    included += 1;
    if (isConfirmed) confirmed += 1;
    if (fact.machineExtracted) machine += 1;
  }

  return {
    mode: input.mode,
    sections,
    sourceMap: [...sourceMap.values()],
    withheld,
    stats: { included, confirmed, unconfirmed: included - confirmed, machineExtracted: machine },
  };
}

export function rolesTable(roles: CareerRole[]): Array<{ title: string; company: string; industry: string; years: string; location: string }> {
  return [...roles]
    .sort((a, b) => (a.startYear ?? 9999) - (b.startYear ?? 9999))
    .map((role) => ({ title: role.title || "—", company: role.company || "—", industry: role.industry || "—", years: yearsLabel(role), location: role.location || "—" }));
}

export function itemLabel(item: Pick<PackageItem, "kind" | "reviewStatus">): string {
  const who: Record<Fact["kind"], string> = {
    direct_statement: "contributor's words",
    source_fact: "uploaded source",
    ai_synthesis: "AI synthesis, to confirm",
    editorial: "editorial note",
  };
  const status = item.reviewStatus === "confirmed" || item.reviewStatus === "corrected" ? "confirmed" : item.reviewStatus === "needs_confirmation" ? "needs confirmation" : "not yet reviewed";
  return `${who[item.kind]}; ${status}`;
}

export { labelOf };
