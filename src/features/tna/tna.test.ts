import { describe, expect, it } from "vitest";

import { skillTaxonomy } from "../../domain/skills/taxonomy";
import { leafBriefs, toSkillShotBriefs, outlineText } from "./briefs";
import { checkTree } from "./check";
import { scaffoldNeeds, scaffoldTree } from "./scaffold";
import { addNode, depthOf, flattenDraft, indentNode, leavesOf, mergeNodes, moveNode, outdentNode, orderedNodes, removeNode, childrenOf } from "./tree";
import { knownSkills, programBriefSchema, type Need, type TopicNode } from "./types";

const brief = programBriefSchema.parse({ topic: "Lean basics for line supervisors", audience: { role: "Line supervisors", level: "foundational" }, goal: "Fewer rework loops on the line." });
const needs: Need[] = ["n1", "n2", "n3", "n4"].map((id, index) => ({ id, statement: `Need number ${index + 1} stated in full`, evidence: "inferred", priority: index < 2 ? "high" : "medium", askClient: null, status: "confirmed" }));
let counter = 0;
const newId = () => `id${++counter}`;
const tree = (): TopicNode[] => flattenDraft(scaffoldTree(brief, needs.map((n) => n.id)).modules, newId);

describe("scaffold", () => {
  it("only uses skills that exist in the Skill Graph", () => {
    for (const slug of tree().flatMap((node) => node.skills)) expect(knownSkills.has(slug), slug).toBe(true);
    expect(skillTaxonomy.length).toBeGreaterThan(40);
  });

  it("gives needs the person can read and a tree with leaves that serve them", () => {
    expect(scaffoldNeeds(brief).needs.length).toBeGreaterThanOrEqual(3);
    const nodes = tree();
    expect(leavesOf(nodes).length).toBe(6);
    const check = checkTree(nodes, needs);
    expect(check.canApprove).toBe(true);
    expect(check.totalMinutes).toBe(48);
  });
});

describe("tree operations", () => {
  it("moves a topic up and down among its siblings and refuses at the ends", () => {
    const nodes = tree();
    const [first, second] = childrenOf(nodes, null);
    const moved = moveNode(nodes, second.id, -1);
    expect(moved.ok && childrenOf(moved.nodes, null)[0].id).toBe(second.id);
    expect(moveNode(nodes, first.id, -1).ok).toBe(false);
  });

  it("indents under the topic above and outdents back, keeping the depth limit", () => {
    const nodes = tree();
    const [a, b] = childrenOf(nodes, null);
    const indented = indentNode(nodes, b.id);
    expect(indented.ok).toBe(true);
    if (!indented.ok) return;
    expect(depthOf(indented.nodes, b.id)).toBe(2);
    // a already has two leaf children, so b (with its leaves) would be 4 levels deep.
    expect(childrenOf(indented.nodes, a.id).at(-1)?.id).toBe(b.id);
    const leaf = childrenOf(nodes, a.id)[1];
    expect(indentNode(nodes, leaf.id).ok).toBe(true);
    const bad = indentNode(indented.nodes, childrenOf(indented.nodes, a.id).find((n) => n.id === b.id)!.id);
    expect(bad.ok).toBe(false);
    const back = outdentNode(indented.nodes, b.id);
    expect(back.ok && depthOf(back.nodes, b.id)).toBe(1);
  });

  it("removes a topic with everything under it and its prerequisite links", () => {
    const nodes = tree().map((n, i) => (i === 3 ? { ...n, prerequisites: [tree()[0].id] } : n));
    const first = childrenOf(nodes, null)[0];
    const result = removeNode(nodes, first.id);
    expect(result.ok && result.nodes.length).toBe(nodes.length - 3);
  });

  it("adds a topic and rejects a name that is too short or a level that is too deep", () => {
    const nodes = tree();
    expect(addNode(nodes, null, "ab", newId).ok).toBe(false);
    const leaf = leavesOf(nodes)[0];
    const third = addNode(nodes, leaf.id, "A third level topic", newId);
    expect(third.ok).toBe(true);
    if (third.ok) expect(addNode(third.nodes, third.nodes.find((n) => n.title === "A third level topic")!.id, "A fourth level", newId).ok).toBe(false);
    const added = addNode(nodes, childrenOf(nodes, null)[0].id, "A new piece of the module", newId);
    expect(added.ok && added.nodes.length).toBe(nodes.length + 1);
  });

  it("merges two topics of one parent, keeping both sets of skills and needs", () => {
    const nodes = tree();
    const [a, b] = childrenOf(nodes, childrenOf(nodes, null)[1].id);
    const merged = mergeNodes(nodes, a.id, b.id);
    expect(merged.ok).toBe(true);
    if (!merged.ok) return;
    const kept = merged.nodes.find((n) => n.id === a.id)!;
    expect(kept.skills).toEqual(expect.arrayContaining([...a.skills, ...b.skills]));
    expect(kept.minutes).toBe(16);
    expect(merged.nodes.some((n) => n.id === b.id)).toBe(false);
    expect(mergeNodes(nodes, a.id, childrenOf(nodes, null)[0].id).ok).toBe(false);
  });

  it("keeps reading order depth first", () => {
    const nodes = tree();
    expect(orderedNodes(nodes)[0].parentId).toBeNull();
    expect(orderedNodes(nodes)).toHaveLength(nodes.length);
  });
});

describe("checkTree", () => {
  it("blocks an empty plan, an unknown skill and a leaf with no skill", () => {
    expect(checkTree([], needs).canApprove).toBe(false);
    const nodes = tree();
    const leaf = leavesOf(nodes)[0];
    expect(checkTree(nodes.map((n) => (n.id === leaf.id ? { ...n, skills: ["made-up-skill"] } : n)), needs).issues.some((i) => i.code === "unknown_skill" && i.severity === "block")).toBe(true);
    expect(checkTree(nodes.map((n) => (n.id === leaf.id ? { ...n, skills: [] } : n)), needs).issues.some((i) => i.code === "no_skill")).toBe(true);
  });

  it("blocks a high-priority need no leaf serves, and only warns for a low one", () => {
    const nodes = tree().map((n) => ({ ...n, needIds: n.needIds.filter((id) => id !== "n1") }));
    const result = checkTree(nodes, needs);
    expect(result.issues.find((i) => i.code === "uncovered_need")?.severity).toBe("block");
    expect(result.canApprove).toBe(false);
    const lowNeeds = needs.map((n) => (n.id === "n1" ? { ...n, priority: "low" as const } : n));
    expect(checkTree(nodes, lowNeeds).issues.find((i) => i.code === "uncovered_need")?.severity).toBe("warn");
  });

  it("warns about a leaf that is too big, too small or serves no need, and about duplicate names", () => {
    const nodes = tree();
    const [a, b, c] = leavesOf(nodes);
    const changed = nodes.map((n) => (n.id === a.id ? { ...n, minutes: 30 } : n.id === b.id ? { ...n, minutes: 1, needIds: [] } : n.id === c.id ? { ...n, title: a.title, parentId: a.parentId } : n));
    const codes = checkTree(changed, needs).issues.map((i) => i.code);
    expect(codes).toEqual(expect.arrayContaining(["too_big", "too_small", "serves_no_need", "duplicate"]));
  });

  it("ignores rejected topics and rejected needs", () => {
    const nodes = tree();
    const first = leavesOf(nodes)[0];
    const result = checkTree(nodes.map((n) => (n.id === first.id ? { ...n, status: "rejected" as const } : n)), needs);
    expect(result.leafCount).toBe(5);
    const rejectedNeeds = needs.map((n) => ({ ...n, status: "rejected" as const }));
    expect(checkTree(nodes, rejectedNeeds).issues.some((i) => i.code === "uncovered_need")).toBe(false);
  });

  it("flags a missing prerequisite", () => {
    const nodes = tree();
    const leaf = leavesOf(nodes)[0];
    expect(checkTree(nodes.map((n) => (n.id === leaf.id ? { ...n, prerequisites: ["gone"] } : n)), needs).issues.some((i) => i.code === "missing_prerequisite")).toBe(true);
  });
});

describe("hand-off", () => {
  it("makes one Skill Shot brief per approved leaf, with the audience and level the coach gave", () => {
    const nodes = tree().map((n) => ({ ...n, status: "approved" as const }));
    const briefs = toSkillShotBriefs(brief, nodes, "A. Coach");
    expect(briefs).toHaveLength(6);
    expect(briefs[0]).toMatchObject({ proficiency: "foundational", contributor: "A. Coach", sourceKind: "design" });
    expect(briefs[0].skills[0].toLevel).toBe(2);
    expect(toSkillShotBriefs(brief, tree(), "A. Coach")).toHaveLength(0);
  });

  it("keeps each topic's id with its brief, so a draft is recognised next time", () => {
    const nodes = tree().map((n) => ({ ...n, status: "approved" as const }));
    const items = leafBriefs(brief, nodes, "A. Coach");
    expect(items.map((item) => item.leafId)).toEqual(leavesOf(nodes).map((leaf) => leaf.id));
  });

  it("writes a readable outline", () => {
    const text = outlineText("Lean basics", tree(), needs);
    expect(text).toContain("Learner needs");
    expect(text).toContain("  - ");
  });
});
