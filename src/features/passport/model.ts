import type { EstimateSource } from "../pathway/estimate";

/**
 * The Skill Passport: what a learner can show, and how firmly. It lists only skills the learner rated, described or completed a
 * lesson for (a skill we merely guess from a related answer is counted but not listed), says where each estimate came from, and never presents self-description as proof. Practice notes, goals, challenges and what a learner wrote to
 * Arya are never part of it, whatever is shared.
 */
export type PassportSkill = {
  skill: string;
  name: string;
  family: string;
  /** 0 to 5. */
  level: number;
  /** 0 to 1. Self-report never goes above 0.7. */
  confidence: number;
  source: EstimateSource;
  /** The learner also described a result for this skill. */
  withResult: boolean;
};

export type PassportEvidence = {
  /** What was completed, by title. */
  title: string;
  kind: "skill-shot" | "conversation";
  date: string;
  skills: string[];
};

export type Passport = {
  name: string;
  currentRole: string;
  targetRole: string | null;
  generatedAt: string;
  skills: PassportSkill[];
  evidence: PassportEvidence[];
  /** How the skills split by what backs them. */
  /** What backs the listed skills, and how many skills are only guessed from related answers and so are left out of the list. */
  basis: { selfRatingOnly: number; described: number; completedLessons: number; inferredNotListed: number };
};

export type ShareOptions = { name: boolean; targetRole: boolean; evidence: boolean };
export const DEFAULT_SHARE: ShareOptions = { name: false, targetRole: true, evidence: true };

export const confidenceLabel = (confidence: number): "Low" | "Medium" | "Higher" => (confidence < 0.35 ? "Low" : confidence < 0.5 ? "Medium" : "Higher");

export const SOURCE_PLAIN: Record<EstimateSource, string> = {
  baseline: "Your own rating of how you work",
  inferred: "Inferred from a related answer",
  diagnostic: "Situations you described",
  evidence: "A lesson you completed with a correct check",
  none: "Not assessed",
};

/** What a person with the link may see. The owner's choices apply; the default shows a first name at most and no contact details. */
export function applyPrivacy(passport: Passport, options: ShareOptions): Passport {
  return {
    ...passport,
    name: options.name ? passport.name : "A FutureSkilz learner",
    currentRole: options.name ? passport.currentRole : "",
    targetRole: options.targetRole ? passport.targetRole : null,
    evidence: options.evidence ? passport.evidence : [],
  };
}

const csvCell = (value: string | number): string => {
  const text = String(value);
  // A cell that starts with a formula character is prefixed so a spreadsheet shows it as text.
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[",\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
};

export function toCsv(passport: Passport): string {
  const header = ["Skill", "Family", "Level (0-5)", "Confidence", "Confidence (0-1)", "Backed by"];
  const rows = passport.skills.map((skill) => [skill.name, skill.family, skill.level.toFixed(1), confidenceLabel(skill.confidence), skill.confidence.toFixed(2), SOURCE_PLAIN[skill.source] + (skill.withResult ? ", with a result you described" : "")]);
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
}

export function summariseBasis(skills: PassportSkill[], inferredNotListed = 0): Passport["basis"] {
  return {
    inferredNotListed,
    selfRatingOnly: skills.filter((skill) => skill.source === "baseline" || skill.source === "inferred").length,
    described: skills.filter((skill) => skill.source === "diagnostic").length,
    completedLessons: skills.filter((skill) => skill.source === "evidence").length,
  };
}
