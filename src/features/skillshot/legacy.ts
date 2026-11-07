import type { SkillShot } from "../journey/model";
import { skillShots } from "../journey/model";
import type { AssetSkill } from "../pathway/assets";
import { LEGACY_SKILLS } from "../pathway/assets";
import type { SkillShotBrief } from "./scaffold";

/**
 * The five original Skill Shots, as briefs for the design agent. A converted Skill Shot keeps the old address (/skill-shots/<slug>),
 * so links and a learner's progress carry over, and it replaces the old page only when an editor publishes it, after the quality
 * checks pass. The old content is the source: its example is kept as an illustration, not as a claim about any real organisation.
 */
export function legacyBrief(shot: SkillShot, skills: AssetSkill[] = LEGACY_SKILLS[shot.slug] ?? []): SkillShotBrief {
  const answer = shot.checkIn.options[shot.checkIn.correctIndex];
  return {
    topic: shot.title,
    slug: shot.slug,
    skills,
    audience: "Working professionals building everyday capability for the AI age",
    proficiency: "foundational",
    sourceKind: "design",
    contributor: "FutureSkilz Learning Design",
    sourceNotes: [
      `Existing lesson being redesigned: ${shot.title}.`,
      `Objective: ${shot.objective}`,
      `Why it matters: ${shot.whyItMatters}`,
      `Core idea: ${shot.concept}`,
      `Example (treat any figures as illustrative, written for teaching): ${shot.example}`,
      `Practice task: ${shot.practicePrompt}`,
      `Existing check question: ${shot.checkIn.question} Options: ${shot.checkIn.options.join(" / ")}. Best answer: ${answer}.`,
      "Keep the meaning of this lesson. Teach it as a full 5 to 10 minute Skill Shot with a worked case, a decision for the learner and a knowledge check.",
    ].join("\n"),
  };
}

export const LEGACY_BRIEFS: SkillShotBrief[] = skillShots.map((shot) => legacyBrief(shot));
