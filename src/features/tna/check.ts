import { childrenOf, depthOf, isLeaf, leavesOf } from "./tree";
import { knownSkills, LEAF_MAX_MINUTES, LEAF_MIN_MINUTES, MAX_DEPTH, type Need, type TopicNode } from "./types";

export type TreeIssue = {
  /** "block" stops approval. "warn" is shown but a person may go ahead. */
  severity: "block" | "warn";
  code: string;
  nodeId?: string;
  message: string;
};

export type TreeCheck = { issues: TreeIssue[]; canApprove: boolean; leafCount: number; totalMinutes: number };

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Checks a topic tree against the learner needs. These are structural checks in code: they find overlaps, gaps and
 * oversize pieces, and they cannot tell whether the content is right. A person still reads the tree before approving.
 */
export function checkTree(allNodes: TopicNode[], needs: Need[]): TreeCheck {
  const nodes = allNodes.filter((node) => node.status !== "rejected");
  const issues: TreeIssue[] = [];
  const add = (severity: TreeIssue["severity"], code: string, message: string, nodeId?: string) => issues.push({ severity, code, message, nodeId });

  if (!nodes.length) {
    add("block", "empty", "There are no topics yet.");
    return { issues, canApprove: false, leafCount: 0, totalMinutes: 0 };
  }

  const ids = new Set(nodes.map((node) => node.id));
  const live = needs.filter((need) => need.status !== "rejected");

  for (const parentId of new Set([null, ...nodes.map((node) => node.parentId)])) {
    const siblings = childrenOf(nodes, parentId);
    siblings.forEach((node, index) => {
      if (siblings.slice(0, index).some((other) => same(other.title, node.title))) add("warn", "duplicate", `"${node.title}" appears twice in the same place. Merge them or tell them apart.`, node.id);
    });
  }

  const leaves = leavesOf(nodes);
  let totalMinutes = 0;
  for (const node of nodes) {
    if (depthOf(nodes, node.id) > MAX_DEPTH) add("block", "too_deep", `"${node.title}" is more than ${MAX_DEPTH} levels deep.`, node.id);
    for (const slug of node.skills) if (!knownSkills.has(slug)) add("block", "unknown_skill", `"${node.title}" uses a skill that is not in the Skill Graph (${slug}).`, node.id);
    for (const pre of node.prerequisites) if (!ids.has(pre)) add("block", "missing_prerequisite", `"${node.title}" needs a topic that is no longer in the plan.`, node.id);
    if (!isLeaf(nodes, node.id) && childrenOf(nodes, node.id).length === 1) add("warn", "single_child", `"${node.title}" has only one topic under it. Fold them together or add the missing piece.`, node.id);
  }

  for (const leaf of leaves) {
    if (!leaf.skills.length) add("block", "no_skill", `"${leaf.title}" is not tied to a skill yet. Choose the skill the learner builds.`, leaf.id);
    if (!leaf.summary.trim()) add("warn", "no_summary", `"${leaf.title}" has no plain-language summary.`, leaf.id);
    if (leaf.minutes == null) add("warn", "no_minutes", `"${leaf.title}" has no time estimate.`, leaf.id);
    else {
      totalMinutes += leaf.minutes;
      if (leaf.minutes > LEAF_MAX_MINUTES) add("warn", "too_big", `"${leaf.title}" is about ${leaf.minutes} minutes: too big for one Skill Shot. Split it.`, leaf.id);
      if (leaf.minutes < LEAF_MIN_MINUTES) add("warn", "too_small", `"${leaf.title}" is under ${LEAF_MIN_MINUTES} minutes. Join it with a neighbour.`, leaf.id);
    }
    if (live.length && !leaf.needIds.some((id) => live.some((need) => need.id === id))) add("warn", "serves_no_need", `"${leaf.title}" does not serve any listed need. Keep it only if there is a reason.`, leaf.id);
  }

  for (const need of live) {
    if (!leaves.some((leaf) => leaf.needIds.includes(need.id))) add(need.priority === "high" ? "block" : "warn", "uncovered_need", `Need not covered by any topic: "${need.statement}"`);
  }

  // A topic that must come first cannot depend on one that comes after it, or on itself through a loop.
  const order = new Map(leaves.map((leaf, index) => [leaf.id, index]));
  for (const leaf of leaves) {
    for (const pre of leaf.prerequisites) {
      const at = order.get(pre);
      if (at != null && at > (order.get(leaf.id) ?? 0)) add("warn", "prerequisite_order", `"${leaf.title}" lists a prerequisite that comes after it. Reorder them.`, leaf.id);
    }
  }

  return { issues, canApprove: !issues.some((issue) => issue.severity === "block"), leafCount: leaves.length, totalMinutes };
}
