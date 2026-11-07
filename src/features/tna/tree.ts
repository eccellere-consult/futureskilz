import { MAX_DEPTH, type DraftNode, type TopicNode } from "./types";

/** Pure operations on the flat list of topic nodes. Each returns a new list with positions renumbered. */
export type Change = { ok: true; nodes: TopicNode[] } | { ok: false; reason: string };

const byPosition = (a: TopicNode, b: TopicNode) => a.position - b.position;
const fail = (reason: string): Change => ({ ok: false, reason });

export const childrenOf = (nodes: TopicNode[], parentId: string | null): TopicNode[] => nodes.filter((node) => node.parentId === parentId).sort(byPosition);

export function depthOf(nodes: TopicNode[], id: string): number {
  let depth = 1;
  let current = nodes.find((node) => node.id === id);
  while (current?.parentId && depth < 50) {
    depth += 1;
    const parentId: string = current.parentId;
    current = nodes.find((node) => node.id === parentId);
  }
  return depth;
}

/** How many levels the node and everything under it span. */
export function heightOf(nodes: TopicNode[], id: string): number {
  const kids = nodes.filter((node) => node.parentId === id);
  return 1 + (kids.length ? Math.max(...kids.map((kid) => heightOf(nodes, kid.id))) : 0);
}

export const isLeaf = (nodes: TopicNode[], id: string): boolean => !nodes.some((node) => node.parentId === id);

/** Depth-first reading order. */
export function orderedNodes(nodes: TopicNode[], parentId: string | null = null): TopicNode[] {
  return childrenOf(nodes, parentId).flatMap((node) => [node, ...orderedNodes(nodes, node.id)]);
}

export const leavesOf = (nodes: TopicNode[]): TopicNode[] => orderedNodes(nodes).filter((node) => isLeaf(nodes, node.id));

function renumber(nodes: TopicNode[]): TopicNode[] {
  const positions = new Map<string, number>();
  const groups = new Map<string | null, TopicNode[]>();
  for (const node of nodes) groups.set(node.parentId, [...(groups.get(node.parentId) ?? []), node]);
  for (const group of groups.values()) group.sort(byPosition).forEach((node, index) => positions.set(node.id, index));
  return nodes.map((node) => ({ ...node, position: positions.get(node.id) ?? 0 }));
}

/** Turns the model's nested answer into rows. Ids come from `newId`; need ids stay as given. */
export function flattenDraft(modules: DraftNode[], newId: () => string): TopicNode[] {
  const rows: TopicNode[] = [];
  const walk = (list: DraftNode[], parentId: string | null) => {
    list.forEach((draft, position) => {
      const id = newId();
      rows.push({
        id,
        parentId,
        position,
        title: draft.title.trim(),
        summary: draft.summary ?? "",
        targetLevel: draft.targetLevel ?? null,
        skills: draft.skills ?? [],
        needIds: draft.needIds ?? [],
        prerequisites: [],
        materialHint: draft.materialHint ?? "",
        evidenceSignal: draft.evidenceSignal ?? "",
        minutes: draft.minutes ?? null,
        status: "proposed",
        origin: "ai",
      });
      if (draft.children?.length) walk(draft.children, id);
    });
  };
  walk(modules, null);
  return rows;
}

export function moveNode(nodes: TopicNode[], id: string, direction: -1 | 1): Change {
  const node = nodes.find((n) => n.id === id);
  if (!node) return fail("That topic was not found.");
  const siblings = childrenOf(nodes, node.parentId);
  const index = siblings.findIndex((n) => n.id === id);
  const target = siblings[index + direction];
  if (!target) return fail(direction < 0 ? "It is already first." : "It is already last.");
  return {
    ok: true,
    nodes: renumber(nodes.map((n) => (n.id === id ? { ...n, position: target.position } : n.id === target.id ? { ...n, position: node.position } : n))),
  };
}

/** Makes the topic the last child of the one before it. */
export function indentNode(nodes: TopicNode[], id: string): Change {
  const node = nodes.find((n) => n.id === id);
  if (!node) return fail("That topic was not found.");
  const siblings = childrenOf(nodes, node.parentId);
  const previous = siblings[siblings.findIndex((n) => n.id === id) - 1];
  if (!previous) return fail("There is no topic above it to move it under.");
  if (depthOf(nodes, previous.id) + heightOf(nodes, id) > MAX_DEPTH) return fail(`A plan can go ${MAX_DEPTH} levels deep at most.`);
  const last = childrenOf(nodes, previous.id).length;
  return { ok: true, nodes: renumber(nodes.map((n) => (n.id === id ? { ...n, parentId: previous.id, position: last } : n))) };
}

/** Moves the topic up one level, to sit just after its parent. */
export function outdentNode(nodes: TopicNode[], id: string): Change {
  const node = nodes.find((n) => n.id === id);
  if (!node) return fail("That topic was not found.");
  const parent = node.parentId ? nodes.find((n) => n.id === node.parentId) : null;
  if (!parent) return fail("It is already at the top level.");
  return { ok: true, nodes: renumber(nodes.map((n) => (n.id === id ? { ...n, parentId: parent.parentId, position: parent.position + 0.5 } : n))) };
}

export function removeNode(nodes: TopicNode[], id: string): Change {
  if (!nodes.some((n) => n.id === id)) return fail("That topic was not found.");
  const gone = new Set<string>([id]);
  for (let grew = true; grew; ) {
    grew = false;
    for (const n of nodes) {
      if (n.parentId && gone.has(n.parentId) && !gone.has(n.id)) {
        gone.add(n.id);
        grew = true;
      }
    }
  }
  return { ok: true, nodes: renumber(nodes.filter((n) => !gone.has(n.id)).map((n) => ({ ...n, prerequisites: n.prerequisites.filter((p) => !gone.has(p)) }))) };
}

export function addNode(nodes: TopicNode[], parentId: string | null, title: string, newId: () => string): Change {
  const clean = title.trim().slice(0, 200);
  if (clean.length < 3) return fail("Give the topic a short name.");
  if (parentId) {
    if (!nodes.some((n) => n.id === parentId)) return fail("That parent was not found.");
    if (depthOf(nodes, parentId) + 1 > MAX_DEPTH) return fail(`A plan can go ${MAX_DEPTH} levels deep at most.`);
  }
  const node: TopicNode = {
    id: newId(),
    parentId,
    position: childrenOf(nodes, parentId).length,
    title: clean,
    summary: "",
    targetLevel: null,
    skills: [],
    needIds: [],
    prerequisites: [],
    materialHint: "",
    evidenceSignal: "",
    minutes: null,
    status: "proposed",
    origin: "person",
  };
  return { ok: true, nodes: renumber([...nodes, node]) };
}

/** Merges the second topic into the first. Both must share a parent. Children and mappings are kept. */
export function mergeNodes(nodes: TopicNode[], keepId: string, absorbId: string): Change {
  const keep = nodes.find((n) => n.id === keepId);
  const absorb = nodes.find((n) => n.id === absorbId);
  if (!keep || !absorb || keepId === absorbId) return fail("Choose two different topics.");
  if (keep.parentId !== absorb.parentId) return fail("Only topics under the same parent can be merged.");
  const union = (a: string[], b: string[]) => [...new Set([...a, ...b])];
  const offset = childrenOf(nodes, keepId).length;
  const moved = new Map(childrenOf(nodes, absorbId).map((child, index) => [child.id, { ...child, parentId: keepId, position: offset + index }]));
  const merged: TopicNode = {
    ...keep,
    title: `${keep.title} and ${absorb.title}`.slice(0, 200),
    summary: [keep.summary, absorb.summary].filter(Boolean).join(" "),
    skills: union(keep.skills, absorb.skills).slice(0, 4),
    needIds: union(keep.needIds, absorb.needIds),
    prerequisites: union(keep.prerequisites, absorb.prerequisites).filter((p) => p !== keepId && p !== absorbId),
    materialHint: [keep.materialHint, absorb.materialHint].filter(Boolean).join(" "),
    minutes: keep.minutes != null || absorb.minutes != null ? (keep.minutes ?? 0) + (absorb.minutes ?? 0) : null,
    status: "proposed",
  };
  const rest = nodes
    .filter((n) => n.id !== absorbId)
    .map((n) => moved.get(n.id) ?? (n.id === keepId ? merged : n))
    .map((n) => ({ ...n, prerequisites: n.prerequisites.map((p) => (p === absorbId ? keepId : p)).filter((p) => p !== n.id) }));
  return { ok: true, nodes: renumber(rest) };
}
