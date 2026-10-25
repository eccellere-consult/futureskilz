import type { CareerRole, Fact, Segment } from "./types";

let counter = 0;
export const uid = (prefix: string): string => `${prefix}-${++counter}`;

export function seg(text: string, patch: Partial<Segment> = {}): Segment {
  const seq = patch.seq ?? ++counter;
  return { id: `seg-${seq}`, seq, source: "interview", speaker: "expert", text, createdAt: "2026-10-25T10:00:00.000Z", ...patch };
}

export function role(patch: Partial<CareerRole> = {}): CareerRole {
  return {
    id: uid("role"), company: "Acme Steel", title: "Plant Manager", industry: "Manufacturing", location: "Pune",
    startYear: 2004, endYear: 2011, ongoing: false, datesApproximate: false, sortOrder: 0, confirmed: true, ...patch,
  };
}

export function fact(patch: Partial<Fact> & Pick<Fact, "statement">): Fact {
  const id = patch.id ?? uid("fact");
  return {
    id, category: "practice", kind: "direct_statement", title: "A fact", details: null, roleId: null, processId: null,
    confidence: "high", reviewStatus: "confirmed", sensitivity: "none", permission: "public", anonymizedStatement: null,
    sources: [{ segmentId: "seg-1", quote: patch.statement }], machineExtracted: true, version: 1, ...patch,
  };
}
