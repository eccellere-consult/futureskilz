import type { LessonSpec } from "../capture/lessons";
import { confirmedSkills, suggestSkills, type LessonSkillMap } from "../pathway/skill-map";
import type { SkillShotBrief } from "./scaffold";
import type { Proficiency } from "./types";

type Lesson = LessonSpec & { skillMap?: LessonSkillMap };

const LEVEL: Record<string, Proficiency> = { foundational: "foundational", working: "working", proficient: "advanced", expert: "advanced" };

/**
 * A published coach lesson, as a brief for the design agent. The coach's own narration is the source, in order, so the agent can
 * keep their sentences; it is told to add structure and a check but no new facts. The coach must approve the result before it is
 * published, because the wording changes even when the meaning should not.
 */
export function lessonBrief(spec: Lesson, lessonId: string): SkillShotBrief {
  const skills = confirmedSkills(spec).length ? confirmedSkills(spec) : (spec.skillMap?.skills.length ? spec.skillMap.skills : suggestSkills(spec, 3).map(({ skill, toLevel }) => ({ skill, toLevel })));
  const parts = [
    `The coach's lesson, in their own words (${spec.attribution}).`,
    `Objective: ${spec.objective}`,
    `Core idea: ${spec.coreConcept}`,
    ...spec.narration.map((paragraph, index) => `Narration ${index + 1}: ${paragraph}`),
    spec.example ? `Example from experience: ${spec.example}` : "",
    spec.caution ? `Caution from experience: ${spec.caution}` : "",
    `Check for the learner: ${spec.check.prompt} ${spec.check.guidance}`,
    spec.prerequisites.length ? `Prerequisites: ${spec.prerequisites.join("; ")}` : "",
  ].filter(Boolean);
  return {
    topic: spec.title.length >= 4 ? spec.title : `${spec.title} lesson`,
    slug: `lesson-${spec.slug}`.slice(0, 80).replace(/-+$/g, ""),
    skills: skills.length ? skills.slice(0, 4) : [{ skill: "communication", toLevel: 2 }],
    audience: spec.audience || "New joiners and working professionals",
    proficiency: LEVEL[spec.proficiency] ?? "working",
    role: spec.roleLabel && spec.roleLabel !== "the role" ? spec.roleLabel : undefined,
    industry: spec.industry || undefined,
    sourceKind: "expert-interview",
    contributor: spec.attribution,
    sourceNotes: parts.join("\n").slice(0, 8000),
    sourceLessonId: lessonId,
  };
}
