import { skillTaxonomy } from "../../domain/skills/taxonomy";
import { skillShots } from "../journey/model";
import { getDesignedSkillShot, designedSkillShots } from "../skillshot";

/**
 * Everything a learner can learn from, seen the same way: what it is, how long it takes, and which capabilities it builds up to
 * which level. The journey picks from this list, so a coach's lesson, a designed Skill Shot and a training kit compete on equal terms.
 */
export type AssetKind = "coach-lesson" | "designed-skill-shot" | "skill-shot" | "kit";
export type AssetSkill = { skill: string; toLevel: number };
export type LearningAsset = {
  id: string;
  kind: AssetKind;
  title: string;
  summary: string;
  href: string;
  minutes: number;
  skills: AssetSkill[];
  practice: string;
  /** Who the words belong to, for coach lessons. */
  attribution?: string;
};

export const KIND_LABEL: Record<AssetKind, string> = {
  "coach-lesson": "Lesson from a coach",
  "designed-skill-shot": "Skill Shot with Arya",
  "skill-shot": "Skill Shot",
  kit: "Training kit",
};

const known = new Set(skillTaxonomy.map((skill) => skill.slug));

/** The capabilities the five original Skill Shots build, and how far they take a learner. */
export const LEGACY_SKILLS: Record<string, AssetSkill[]> = {
  "ai-decision-brief": [{ skill: "ai-assisted-decision-making", toLevel: 2.5 }, { skill: "prompting", toLevel: 2.5 }, { skill: "decision-making", toLevel: 2.5 }],
  "assumption-test": [{ skill: "critical-thinking", toLevel: 2.5 }, { skill: "judgment", toLevel: 2.5 }, { skill: "analytical-thinking", toLevel: 2.5 }],
  "three-options": [{ skill: "creative-thinking", toLevel: 2.5 }, { skill: "decision-making", toLevel: 2.5 }],
  "influence-map": [{ skill: "influence", toLevel: 2.5 }, { skill: "stakeholder-management", toLevel: 2.5 }, { skill: "communication", toLevel: 2.5 }],
  "change-reset": [{ skill: "adaptability", toLevel: 2.5 }, { skill: "resilience", toLevel: 2 }, { skill: "leadership", toLevel: 2 }],
};

export function skillShotAssets(): LearningAsset[] {
  return skillShots.map((shot) => ({
    id: `skill-shot:${shot.slug}`,
    kind: "skill-shot" as const,
    title: shot.title,
    summary: shot.objective,
    href: `/skill-shots/${shot.slug}`,
    minutes: shot.durationMinutes,
    skills: LEGACY_SKILLS[shot.slug] ?? [],
    practice: shot.practicePrompt,
  }));
}

import type { Blueprint } from "../skillshot/types";

export function blueprintAsset(blueprint: Blueprint): LearningAsset {
  const spoken = blueprint.scenes.reduce((sum, scene) => sum + scene.narration.trim().split(/\s+/).length, 0) / 145;
  const paused = blueprint.scenes.reduce((sum, scene) => sum + scene.pauseSeconds + (scene.interaction?.thinkSeconds ?? 0), 0) / 60;
  return {
    id: `designed:${blueprint.meta.id}`,
    kind: "designed-skill-shot",
    title: blueprint.meta.title,
    summary: blueprint.design.learningObjective,
    href: `/skill-shots/${blueprint.meta.id}`,
    minutes: Math.max(5, Math.round(spoken + paused)),
    skills: blueprint.meta.skillMap,
    practice: blueprint.design.workplaceTransferTask,
  };
}

export const designedSkillShotAssets = (): LearningAsset[] => designedSkillShots.map(blueprintAsset);

export function kitAssets(): LearningAsset[] {
  return [
    {
      id: "kit:problem-solving",
      kind: "kit",
      title: "Problem Solving kit",
      summary: "Work a real business problem from definition to a one-page report, one proven method at a time.",
      href: "/problem-solving",
      minutes: 90,
      skills: [{ skill: "problem-solving", toLevel: 3.5 }, { skill: "analytical-thinking", toLevel: 3 }, { skill: "critical-thinking", toLevel: 3 }, { skill: "data-literacy", toLevel: 2.5 }],
      practice: "Bring a real problem from your work and carry it through the kit's steps.",
    },
  ];
}

export function builtInAssets(): LearningAsset[] {
  return [...designedSkillShotAssets(), ...skillShotAssets(), ...kitAssets()];
}

/** Drops capabilities that are not in the Skill Graph, so a typo in one list can never break a journey. */
export function validAssetSkills(skills: AssetSkill[]): AssetSkill[] {
  return skills.filter((item) => known.has(item.skill) && item.toLevel > 0 && item.toLevel <= 5);
}

export const designedById = getDesignedSkillShot;
