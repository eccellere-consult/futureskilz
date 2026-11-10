import { describe, expect, it } from "vitest";

import { briefSchema } from "@/server/agents/instructional-design";

import { MIN_MATERIAL_CHARS, PART_CHARS, materialBrief, splitMaterial } from "./from-material";

const para = (n: number) => `Paragraph ${n}. `.padEnd(400, "Self awareness means noticing what you feel and why. ");

describe("splitMaterial", () => {
  it("gives nothing for too little text, and one part for a short document", () => {
    expect(splitMaterial("too short", 5)).toEqual([]);
    const parts = splitMaterial(Array.from({ length: 3 }, (_, i) => para(i)).join("\n"), 5);
    expect(parts).toHaveLength(1);
    expect(parts[0]).toMatchObject({ index: 1, of: 1 });
  });
  it("cuts a long document into parts no longer than the limit allows, and stops at the limit", () => {
    const long = Array.from({ length: 120 }, (_, i) => para(i)).join("\n");
    const parts = splitMaterial(long, 3);
    expect(parts).toHaveLength(3);
    expect(parts.every((part) => part.text.length <= PART_CHARS + MIN_MATERIAL_CHARS)).toBe(true);
  });
});

describe("materialBrief", () => {
  it("is a brief the design agent accepts, carrying the reference, the project and the Autopilot mark", () => {
    const [part] = splitMaterial(Array.from({ length: 3 }, (_, i) => para(i)).join("\n"), 5);
    const brief = briefSchema.parse(materialBrief(part, { title: "Self awareness slides", contributor: "Asha", projectId: "11111111-2222-3333-4444-555555555555", tag: "11111111" }));
    expect(brief.sourceNotes).toContain("REFERENCE:");
    expect(brief.sourceNotes).toContain("Self awareness means");
    expect(brief.slug).toBe("doc-11111111-1");
    expect(brief.autopilot).toBe(true);
    expect(brief.sourceProjectId).toBe("11111111-2222-3333-4444-555555555555");
  });
  it("still makes a valid brief from a very short title", () => {
    const [part] = splitMaterial(para(1), 5);
    expect(briefSchema.safeParse(materialBrief(part, { title: "AI", contributor: "Asha", projectId: "p1", tag: "abc12345" })).success).toBe(true);
  });
});
