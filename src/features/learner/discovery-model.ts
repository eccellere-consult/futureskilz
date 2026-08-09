import {
  skillFamilies,
  skillsForFamilies,
  type SkillFamilyId,
} from "../../domain/skills/taxonomy";

export type FocusId = "career" | "leadership" | "business" | "ai";
export type ResponsibilityLevel = "individual" | "manager" | "leader" | "founder";
export type HorizonId = "90-days" | "6-months" | "12-months" | "exploring";
export type ChallengeId = "clarity" | "decisions" | "influence" | "execution" | "change" | "technology";
export type WeeklyMinutes = 15 | 30 | 60 | 120;

export const focusOptions: Array<{ value: FocusId; label: string; detail: string }> = [
  { value: "career", label: "Grow or change my career", detail: "Become ready for a larger or different role" },
  { value: "leadership", label: "Lead people with confidence", detail: "Align, influence and develop others" },
  { value: "business", label: "Deliver stronger business results", detail: "Improve decisions, execution and measurable outcomes" },
  { value: "ai", label: "Work better with AI", detail: "Use AI practically, responsibly and with sound judgment" },
];

export const responsibilityOptions: Array<{ value: ResponsibilityLevel; label: string }> = [
  { value: "individual", label: "Individual contributor" },
  { value: "manager", label: "People or project manager" },
  { value: "leader", label: "Business or functional leader" },
  { value: "founder", label: "Founder or independent professional" },
];

export const horizonOptions: Array<{ value: HorizonId; label: string; detail: string }> = [
  { value: "90-days", label: "Within 90 days", detail: "A near-term work outcome" },
  { value: "6-months", label: "Within 6 months", detail: "A meaningful capability shift" },
  { value: "12-months", label: "Within 12 months", detail: "A larger role or career move" },
  { value: "exploring", label: "I am exploring", detail: "Help me clarify the destination" },
];

export const challengeOptions: Array<{ value: ChallengeId; label: string; detail: string }> = [
  { value: "clarity", label: "Making sense of complexity", detail: "The problem is unclear or has too many moving parts" },
  { value: "decisions", label: "Making a sound decision", detail: "Evidence is incomplete or the trade-offs are difficult" },
  { value: "influence", label: "Getting people aligned", detail: "Progress depends on people I do not directly control" },
  { value: "execution", label: "Turning plans into results", detail: "Priorities, ownership or follow-through break down" },
  { value: "change", label: "Adapting through change", detail: "The situation is shifting faster than the plan" },
  { value: "technology", label: "Using data, digital tools or AI", detail: "I need more confidence or a better working method" },
];

export const weeklyOptions: Array<{ value: WeeklyMinutes; label: string; detail: string }> = [
  { value: 15, label: "15 minutes", detail: "One focused practice each week" },
  { value: 30, label: "30 minutes", detail: "Two short learning and practice loops" },
  { value: 60, label: "1 hour", detail: "A deeper weekly capability sprint" },
  { value: 120, label: "2 hours", detail: "An accelerated path with more evidence" },
];

export { skillFamilies };
export type { SkillFamilyId };

export function availableDiscoverySkills(familyIds: SkillFamilyId[]) {
  return skillsForFamilies(familyIds);
}

export function toggleSelection<Value>(values: Value[], value: Value, maximum: number): Value[] {
  if (values.includes(value)) return values.filter((candidate) => candidate !== value);
  if (values.length >= maximum) return values;
  return [...values, value];
}