import { rootCauseSkillShot } from "./samples/root-cause";
import type { Blueprint } from "./types";

/** Designed Skill Shots, by address. */
export const designedSkillShots: Blueprint[] = [rootCauseSkillShot];

export const getDesignedSkillShot = (id: string): Blueprint | undefined => designedSkillShots.find((item) => item.meta.id === id);
