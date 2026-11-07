import { skillTaxonomy } from "../../domain/skills/taxonomy";
import type { TargetRole } from "../pathway/roles";
import { scoreDiagnostic, FAMILY_NAME, type DiagnosticAnswer, type DiagnosticSkill } from "./engine";
import { QUESTIONS, questionById } from "./questions";

/**
 * How the conversation ends: what was heard, what it may mean, what is still uncertain, and what happens next. The
 * learner should be able to see that the answers were used, and be told plainly how far to trust the result.
 */
export type ConversationSummary = {
  heard: string[];
  mayMean: string[];
  uncertain: string[];
  next: { label: string; href: string };
};

const names = new Map(skillTaxonomy.map((skill) => [skill.slug, skill.name]));
const nameOf = (skill: string) => names.get(skill) ?? skill;
const list = (items: string[]) => (items.length <= 2 ? items.join(" and ") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`);

export function summarise(answers: DiagnosticAnswer[], role?: TargetRole): ConversationSummary {
  const result = scoreDiagnostic(answers);
  const direct = result.skills.filter((skill) => skill.confidence >= 0.3);
  const heard: string[] = answers
    .filter((answer) => answer.option !== null)
    .slice(0, 3)
    .map((answer) => {
      const question = questionById(answer.questionId)!;
      return `${question.topic}: “${question.options[answer.option!]?.text ?? ""}”`;
    });
  if (result.noSituation.length) heard.push(`You said you had not been in ${result.noSituation.length === 1 ? "one of these situations" : `${result.noSituation.length} of these situations`} recently, so I have not guessed about them.`);

  const mayMean: string[] = [];
  const strong = [...direct].filter((skill) => skill.level >= 3).sort((a, b) => b.level - a.level).slice(0, 3);
  if (strong.length) mayMean.push(`${list(strong.map((skill) => nameOf(skill.skill)))} look like strengths to build on.`);
  const gapsAgainstRole = role
    ? role.requirements.flatMap((need) => {
        const found = direct.find((skill) => skill.skill === need.skill);
        return found && need.level - found.level > 0.5 ? [{ skill: need.skill, gap: need.level - found.level }] : [];
      }).sort((a, b) => b.gap - a.gap).slice(0, 2)
    : [];
  if (gapsAgainstRole.length) mayMean.push(`For ${role!.title}, ${list(gapsAgainstRole.map((item) => nameOf(item.skill)))} look${gapsAgainstRole.length === 1 ? "s" : ""} furthest from what the role needs.`);
  else if (!role) {
    const low = [...direct].filter((skill) => skill.level < 2.5).sort((a, b) => a.level - b.level).slice(0, 2);
    if (low.length) mayMean.push(`${list(low.map((skill) => nameOf(skill.skill)))} offer the quickest gains.`);
  }
  if (!mayMean.length) mayMean.push("Your answers were spread evenly, so nothing stands out yet.");

  const asked = new Set(answers.map((answer) => questionById(answer.questionId)?.family));
  const notAsked = [...new Set(QUESTIONS.map((question) => question.family))].filter((family) => !asked.has(family));
  const uncertain = [
    "These are your own descriptions of recent situations, not measured results. Completing a lesson and showing your work will firm them up.",
    ...(result.skills.some((skill) => skill.kind === "reported-behaviour-with-result") ? [] : ["You did not describe a specific result for any of them, so I trust them a little less."]),
    ...(notAsked.length ? [`I did not ask about ${list(notAsked.map((family) => FAMILY_NAME(family).toLowerCase()))}, so nothing here speaks to them.`] : []),
  ];

  return {
    heard,
    mayMean,
    uncertain,
    next: role ? { label: `See your gaps and path for ${role.title}`, href: "/journey" } : { label: "Pick a target role and see your gaps", href: "/journey" },
  };
}

export type { DiagnosticSkill };
