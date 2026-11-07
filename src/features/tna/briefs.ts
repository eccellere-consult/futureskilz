import type { SkillShotBrief } from "../skillshot/scaffold";

import { depthOf, leavesOf, orderedNodes } from "./tree";
import type { Need, ProgramBrief, Proficiency, TopicNode } from "./types";

const DEFAULT_LEVEL: Record<Proficiency, number> = { foundational: 2, working: 3, advanced: 4 };

/** One brief per approved leaf: the hand-off to the Instructional Design Agent (Stage C). Nothing here calls the AI. */
export function toSkillShotBriefs(brief: ProgramBrief, nodes: TopicNode[], contributor: string): SkillShotBrief[] {
  return leavesOf(nodes.filter((node) => node.status === "approved")).map((leaf) => {
    const toLevel = leaf.targetLevel ?? DEFAULT_LEVEL[brief.audience.level];
    const notes = [leaf.summary, leaf.evidenceSignal ? `Evidence the learner can do it: ${leaf.evidenceSignal}` : "", leaf.materialHint ? `Material to use: ${leaf.materialHint}` : ""].filter(Boolean).join("\n");
    return {
      topic: leaf.title.slice(0, 160),
      skills: leaf.skills.slice(0, 4).map((skill) => ({ skill, toLevel })),
      audience: `${brief.audience.role} (${brief.audience.level})`.slice(0, 300),
      proficiency: brief.audience.level,
      role: brief.audience.role.slice(0, 160),
      sourceNotes: notes,
      contributor,
      sourceKind: "design" as const,
    };
  });
}

/** A plain-text outline for printing or copying. */
export function outlineText(title: string, nodes: TopicNode[], needs: Need[]): string {
  const lines = [title, "", "Learner needs"];
  needs.filter((need) => need.status !== "rejected").forEach((need, index) => lines.push(`${index + 1}. ${need.statement} (${need.priority} priority; ${need.evidence})`));
  lines.push("", "Topics");
  for (const node of orderedNodes(nodes.filter((n) => n.status !== "rejected"))) {
    const indent = "  ".repeat(depthOf(nodes, node.id) - 1);
    lines.push(`${indent}- ${node.title}${node.minutes ? ` (${node.minutes} min)` : ""}`);
    if (node.summary) lines.push(`${indent}  ${node.summary}`);
  }
  return lines.join("\n");
}
