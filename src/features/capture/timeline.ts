import { sentencesOf, yearSpans } from "./signals";
import type { CareerRole } from "./types";

/**
 * Turns a career walk-through into candidate jobs and checks a timeline for problems. Candidates are suggestions the
 * contributor corrects; nothing here is trusted until they confirm it. Approximate dates stay approximate.
 */

export type RoleCandidate = {
  company: string;
  title: string;
  startYear: number | null;
  endYear: number | null;
  ongoing: boolean;
  datesApproximate: boolean;
  /** The sentence the candidate was read from, kept as its source quote. */
  quote: string;
};

const TITLE_AT_COMPANY = /\b(?:as|was|worked as|joined as|became|promoted to|moved to|rose to)\s+(?:a|an|the)?\s*([A-Z][\w&/\-]*(?:\s+(?:of\s+)?[A-Z&][\w&/\-]*){0,5}?)\s+(?:at|with|for|in)\s+([A-Z][\w&.'\-]*(?:\s+[A-Z&][\w&.'\-]*){0,4})/;
const TITLE_COMMA_COMPANY = /\b([A-Z][\w&/\-]*(?:\s+[A-Z&][\w&/\-]*){0,4}),?\s+(?:at|with|for)\s+([A-Z][\w&.'\-]*(?:\s+[A-Z&][\w&.'\-]*){0,4})/;
const COMPANY_DASH_TITLE = /^\s*(?:\d+[.)]\s*)?([A-Z][\w&.'\-]*(?:\s+[A-Z&][\w&.'\-]*){0,4})\s*[-–—:,]\s*([A-Za-z][\w&/\- ]{2,50}?)\s*(?:\(|,|\d{4}|$)/;
const TRAILING_YEARS = /\s*[(,]?\s*(?:around|about|circa|c\.|approx(?:imately)?\.?|roughly|in)?\s*(?:19[5-9]|20[0-4])\d.*$/i;

const LEADING_FILLER = /^(?:and|then|later|next|after that|afterwards|finally|earlier|before that|first|firstly|initially|currently|now|so|i|we|my|in|at|from)\b[,\s]*/i;

/** "Then Planning Manager" is a title with a connector in front of it. */
export function tidyTitle(title: string): string {
  let out = title.trim();
  for (let i = 0; i < 4; i += 1) {
    const next = out.replace(LEADING_FILLER, "").trim();
    if (next === out) break;
    out = next;
  }
  return out;
}

export function roleCandidatesFromText(text: string): RoleCandidate[] {
  const chunks = text
    .split(/\n+|;\s+/)
    .flatMap((line) => (line.length > 220 ? sentencesOf(line) : [line]))
    .map((chunk) => chunk.trim())
    .filter(Boolean);
  const out: RoleCandidate[] = [];
  const seen = new Set<string>();
  for (const chunk of chunks) {
    const spans = yearSpans(chunk);
    if (spans.length === 0) continue;
    for (const span of spans) {
      let title = "";
      let company = "";
      const a = TITLE_AT_COMPANY.exec(chunk);
      const b = a ?? TITLE_COMMA_COMPANY.exec(chunk);
      if (b) {
        title = tidyTitle(b[1]);
        company = b[2].replace(TRAILING_YEARS, "").trim();
      } else {
        const c = COMPANY_DASH_TITLE.exec(chunk);
        if (c) {
          company = c[1].trim();
          title = tidyTitle(c[2]);
        }
      }
      const key = `${span.start}-${span.end}-${company}-${title}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        company,
        title,
        startYear: span.start,
        endYear: span.end,
        ongoing: span.ongoing,
        datesApproximate: span.approximate,
        quote: chunk.slice(0, 400),
      });
    }
  }
  return out;
}

export type TimelineFlag = {
  roleId: string | null;
  severity: "conflict" | "overlap" | "gap" | "vague" | "approximate";
  message: string;
};

export type Timeline = {
  roles: CareerRole[];
  flags: TimelineFlag[];
  span: { from: number | null; to: number | null };
};

export function buildTimeline(roles: CareerRole[], now = new Date()): Timeline {
  const currentYear = now.getUTCFullYear();
  const flags: TimelineFlag[] = [];
  const label = (role: CareerRole) => [role.title, role.company].filter(Boolean).join(" at ") || "an unnamed job";
  const ordered = [...roles].sort((a, b) => (a.startYear ?? 9999) - (b.startYear ?? 9999) || a.sortOrder - b.sortOrder);

  for (const role of ordered) {
    if (!role.company || !role.title) flags.push({ roleId: role.id, severity: "vague", message: `The employer or title for ${label(role)} is missing.` });
    if (role.startYear == null) flags.push({ roleId: role.id, severity: "vague", message: `${label(role)} has no start year.` });
    if (role.startYear != null && role.endYear != null && role.endYear < role.startYear)
      flags.push({ roleId: role.id, severity: "conflict", message: `${label(role)} ends (${role.endYear}) before it starts (${role.startYear}).` });
    if ((role.endYear ?? 0) > currentYear) flags.push({ roleId: role.id, severity: "conflict", message: `${label(role)} ends in the future (${role.endYear}).` });
    if (role.ongoing && ordered.some((other) => other.id !== role.id && (other.startYear ?? 0) > (role.startYear ?? 0) + 1 && !other.ongoing))
      flags.push({ roleId: role.id, severity: "conflict", message: `${label(role)} is marked ongoing, but a later job starts after it.` });
    if (role.datesApproximate) flags.push({ roleId: role.id, severity: "approximate", message: `Dates for ${label(role)} are approximate.` });
  }

  for (let i = 0; i < ordered.length - 1; i += 1) {
    const current = ordered[i];
    const next = ordered[i + 1];
    const currentEnd = current.ongoing ? currentYear : current.endYear;
    if (currentEnd == null || next.startYear == null) continue;
    if (currentEnd - next.startYear > 1)
      flags.push({ roleId: next.id, severity: "overlap", message: `${label(current)} and ${label(next)} overlap by ${currentEnd - next.startYear} years. Was this a parallel role or a date to correct?` });
    else if (next.startYear - currentEnd > 2)
      flags.push({ roleId: next.id, severity: "gap", message: `There is a ${next.startYear - currentEnd} year gap between ${label(current)} and ${label(next)}. Anything to add?` });
  }

  const starts = ordered.map((role) => role.startYear).filter((year): year is number => year != null);
  const ends = ordered.map((role) => (role.ongoing ? currentYear : role.endYear)).filter((year): year is number => year != null);
  return { roles: ordered, flags, span: { from: starts.length ? Math.min(...starts) : null, to: ends.length ? Math.max(...ends) : null } };
}

export function yearsLabel(role: Pick<CareerRole, "startYear" | "endYear" | "ongoing" | "datesApproximate">): string {
  const start = role.startYear ?? "?";
  const end = role.ongoing ? "present" : (role.endYear ?? "?");
  return `${role.datesApproximate ? "c. " : ""}${start}–${end}`;
}
