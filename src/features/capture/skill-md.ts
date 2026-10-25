import { itemLabel, rolesTable, type KnowledgePackage, type PackageItem, type SectionId } from "./knowledge-package";
import type { OpenQuestion } from "./planner";
import type { Timeline } from "./timeline";
import type { CareerRole } from "./types";

/**
 * Renders the canonical `skill.md` (skill, Step 7). Plain Markdown a person or another tool can read, with:
 * front matter, a review status, source references on every claim, tables where they help, and the contributor's words kept
 * apart from machine interpretation. A draft never states an unconfirmed claim as established fact.
 */

export type ReviewState = "draft" | "awaiting-contributor-review" | "approved" | "published";

export type SkillMeta = {
  title: string;
  slug: string;
  version: string;
  status: ReviewState;
  generatedAt: string;
  contributorName: string;
  /** False when the contributor has not consented to being named: the profile is left out. */
  showProfile: boolean;
  roles: CareerRole[];
  timeline: Timeline;
  openQuestions: OpenQuestion[];
  uploads: Array<{ filename: string; status: string; ownership: string }>;
  consents: Array<{ purpose: string; granted: boolean }>;
};

const slugify = (text: string): string =>
  text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "contributor";

export function skillName(contributor: string, topic: string): string {
  return `futureskilz-${slugify(contributor)}-${slugify(topic)}`.slice(0, 90);
}

const escapeCell = (value: string): string => value.replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
const refs = (item: PackageItem): string => (item.refs.length ? ` [${item.refs.join(", ")}]` : "");

function bullet(item: PackageItem, mode: KnowledgePackage["mode"]): string {
  const label = mode === "publish" ? "" : ` _(${itemLabel(item)})_`;
  const heading = item.title ? `**${item.title}.** ` : "";
  return `- ${heading}${item.text}${refs(item)}${label}`;
}

function groupByProcess(items: PackageItem[]): Map<string, PackageItem[]> {
  const groups = new Map<string, PackageItem[]>();
  for (const item of items) {
    const key = (typeof item.details?.process === "string" && item.details.process) || item.processId || "General";
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return groups;
}

export function renderSkillMd(pkg: KnowledgePackage, meta: SkillMeta): string {
  const lines: string[] = [];
  const section = (id: SectionId) => pkg.sections.find((candidate) => candidate.id === id)!;
  const heading = (id: SectionId) => {
    const s = section(id);
    lines.push("", `## ${s.number}. ${s.title}`, "");
  };
  const list = (id: SectionId, empty = "_Nothing captured yet. See open questions._") => {
    const items = section(id).items;
    if (items.length === 0) lines.push(empty);
    for (const item of items) lines.push(bullet(item, pkg.mode));
  };

  lines.push(
    "---",
    `name: ${meta.slug}`,
    `version: ${meta.version}`,
    `description: Source-traced teaching knowledge from ${meta.showProfile ? meta.contributorName : "an experienced professional"}, ${meta.title}.`,
    `status: ${meta.status}`,
    `generated: ${meta.generatedAt}`,
    `mode: ${pkg.mode}`,
    "---",
    "",
    `# ${meta.title}`,
    "",
    `> **Review status: \`${meta.status}\`.** ${
      pkg.mode === "draft"
        ? "This is a working draft. Statements marked _not yet reviewed_ or _needs confirmation_ are the system's reading of the contributor's words and must be confirmed before use."
        : "Every statement below was confirmed by the contributor and cleared for sharing."
    }`,
    "> **Reading the labels.** _Contributor's words_ restates what was said. _Uploaded source_ comes from a document. _AI synthesis_ is an interpretation. Bracketed references such as [S12] point to the source map in section 19.",
  );

  heading("overview");
  lines.push(
    `- **Audience:** new joiners and working professionals preparing for the roles described below.`,
    `- **Scope:** ${meta.roles.length} job${meta.roles.length === 1 ? "" : "s"} across ${meta.timeline.span.from ?? "?"}–${meta.timeline.span.to ?? "?"}. Items: ${pkg.stats.included} (${pkg.stats.confirmed} confirmed, ${pkg.stats.unconfirmed} awaiting review).`,
  );
  list("overview", "");

  heading("expertise");
  if (!meta.showProfile) lines.push("_The contributor has not consented to a public profile, so this section is withheld._");
  else {
    lines.push(`**Contributor:** ${meta.contributorName}`, "");
    if (meta.roles.length) {
      lines.push("| Role | Employer | Industry | Years | Location |", "|---|---|---|---|---|");
      for (const row of rolesTable(meta.roles)) lines.push(`| ${escapeCell(row.title)} | ${escapeCell(row.company)} | ${escapeCell(row.industry)} | ${row.years} | ${escapeCell(row.location)} |`);
      lines.push("");
    }
    for (const flag of meta.timeline.flags.filter((f) => f.severity !== "approximate")) lines.push(`- ⚠ ${flag.message}`);
    list("expertise", "");
  }

  heading("industry");
  list("industry");
  heading("factors");
  list("factors");
  heading("functions");
  list("functions");

  heading("processes");
  list("processes");

  heading("roles");
  list("roles");

  heading("skills");
  const skills = section("skills").items;
  if (skills.length === 0) lines.push("_No skills captured yet._");
  else {
    lines.push("| Skill or evidence | Source | Proficiency (foundational, working, proficient, expert) |", "|---|---|---|");
    for (const item of skills) {
      lines.push(`| ${escapeCell(`${item.title}: ${item.text}`.slice(0, 280))} | ${item.refs.join(", ") || "—"} | Proposed mapping for review. No level is set without evidence. |`);
    }
  }

  heading("kpis");
  const kpis = section("kpis").items;
  if (kpis.length === 0) lines.push("_No measures captured yet._");
  else {
    lines.push("| Measure | Definition, baseline, target and result as stated | Source | Status |", "|---|---|---|---|");
    for (const item of kpis) {
      const details = item.details ?? {};
      const missing = ["definition", "baseline", "target", "period", "result"].filter((key) => key in details && details[key] == null);
      const note = missing.length ? ` _Not stated: ${missing.join(", ")}._` : "";
      lines.push(`| ${escapeCell(item.title)} | ${escapeCell(item.text)}${note} | ${item.refs.join(", ") || "—"} | ${itemLabel(item)} |`);
    }
    lines.push("", "_Targets and results appear only where the contributor supplied them. None are inferred._");
  }

  heading("practices");
  list("practices");

  heading("howto");
  const howTo = section("howto").items;
  if (howTo.length === 0) lines.push("_No process walked through step by step yet._");
  for (const [process, items] of groupByProcess(howTo)) {
    lines.push(`### ${process}`, "");
    for (const item of items) {
      lines.push(bullet(item, pkg.mode));
      const steps = item.details?.steps;
      if (Array.isArray(steps) && pkg.mode === "draft") {
        steps.forEach((step, index) => lines.push(`  ${index + 1}. ${String(step)}`));
      }
    }
    lines.push("");
  }

  heading("tools");
  list("tools");
  heading("cases");
  list("cases");
  heading("mistakes");
  list("mistakes");
  heading("leadership");
  list("leadership");
  heading("training");
  list("training");

  heading("paths");
  const readiness = section("training").items.filter((item) => item.title.toLowerCase().includes("30, 60 and 90") || item.title.toLowerCase().includes("teach a new joiner first"));
  lines.push(
    "_Proposed interpretation — confirm with contributor._ A suggested order is context, function, role, core process, tools, practice, exceptions, assessment, advanced cases. It is adapted to the evidence above in `learning_path.md` once lessons exist.",
  );
  for (const item of readiness) lines.push(`- Contributor's own order of teaching: ${item.text}${refs(item)}`);

  heading("open");
  const synthesis = pkg.sections.flatMap((s) => s.items).filter((item) => item.kind === "ai_synthesis");
  if (synthesis.length) {
    lines.push("### Proposed interpretation — confirm with contributor", "");
    for (const item of synthesis) lines.push(bullet(item, pkg.mode));
    lines.push("");
  }
  lines.push("### Open questions", "");
  if (meta.openQuestions.length === 0) lines.push("- None outstanding.");
  for (const q of meta.openQuestions.slice(0, 20)) lines.push(`- ${q.text} _(${q.reason})_`);
  lines.push("", "### Timeline checks", "");
  if (meta.timeline.flags.length === 0) lines.push("- No conflicts found.");
  for (const flag of meta.timeline.flags) lines.push(`- ${flag.severity}: ${flag.message}`);
  if (pkg.withheld.length) {
    lines.push("", "### Held back", "");
    for (const w of pkg.withheld.slice(0, 40)) lines.push(`- ${w.title}: ${w.reason}`);
  }
  lines.push("", "### Limitations", "", "- Content completion is not proof of skill. Use the checks and practical demonstrations in each lesson.", "- Figures appear only where the contributor gave them.");

  heading("sources");
  lines.push("| Ref | Origin | Quote or location |", "|---|---|---|");
  for (const source of pkg.sourceMap) {
    lines.push(`| ${source.ref} | ${source.origin}${source.locator ? ` (${source.locator})` : ""} | ${escapeCell(source.quote.slice(0, 220))}${source.quote.length > 220 ? "…" : ""} |`);
  }
  lines.push("", "**Consents on record**", "");
  for (const consent of meta.consents) lines.push(`- ${consent.purpose}: ${consent.granted ? "granted" : "not granted"}`);
  if (meta.uploads.length) {
    lines.push("", "**Uploaded material**", "");
    for (const upload of meta.uploads) lines.push(`- ${upload.filename} — ${upload.status}; ownership: ${upload.ownership}`);
  }
  lines.push("");
  return lines.join("\n");
}
