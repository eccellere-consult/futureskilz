import { describe, expect, it } from "vitest";

import type { PackageItem, SectionId } from "../capture/knowledge-package";
import { FRAMEWORKS, pickFramework } from "./framework-lens";
import { MAX_STATEMENTS, pieceBrief, planPieces } from "./from-package";

const item = (n: number, refs: string[] = ["D1"]): PackageItem => ({ factId: `f${n}`, title: `Point ${n}`, text: `Statement ${n} about the work.`, kind: "process", reviewStatus: "confirmed", confidence: 0.9, roleId: null, processId: null, refs, details: null, anonymized: false }) as unknown as PackageItem;
const section = (id: SectionId, count: number) => ({ id, number: 1, title: id, items: Array.from({ length: count }, (_, i) => item(i + 1)) });

describe("planPieces", () => {
  it("skips non-teachable sections and sections with a single statement, and says why", () => {
    const plan = planPieces({ sections: [section("overview", 5), section("howto", 3), section("tools", 1)] } as never, "Pricing", "abc");
    expect(plan.pieces.map((p) => p.key)).toEqual(["pkg-abc-howto"]);
    expect(plan.leftOut).toHaveLength(1);
  });
  it("splits a long section into even parts", () => {
    const plan = planPieces({ sections: [section("howto", MAX_STATEMENTS + 1)] } as never, "Pricing", "abc");
    expect(plan.pieces.map((p) => p.items.length)).toEqual([4, 4]);
    expect(plan.pieces[1].key).toBe("pkg-abc-howto-2");
  });
});

describe("framework lens", () => {
  it("suggests the method that fits the piece, and says to use it only where the statements fit", () => {
    const [piece] = planPieces({ sections: [section("mistakes", 3)] } as never, "Pricing", "abc").pieces;
    const brief = pieceBrief(piece, { contributor: "Asha", projectId: "p1" });
    expect(brief.sourceNotes).toContain("5 Whys");
    expect(brief.sourceNotes).toContain("ONLY where the confirmed statements fit");
  });
});

describe("framework list", () => {
  it("holds the twelve Problem Solving methods of the Framework Workspace skill, each with steps", () => {
    const ids = FRAMEWORKS.map((framework) => framework.id);
    for (const id of ["five-w-two-h", "copq", "pareto", "is-is-not", "affinity", "fishbone", "five-whys", "impact-effort", "pugh", "fmea-lite", "pdca", "a3"]) expect(ids).toContain(id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(FRAMEWORKS.every((framework) => framework.steps.length >= 3)).toBe(true);
  });
  it("picks by the words when the section alone does not decide", () => {
    expect(pickFramework("practices", "We compare each vendor option against the same criteria before we choose between them, a trade-off")?.id).toBe("pugh");
    expect(pickFramework("overview", "nothing that matches")).toBeNull();
  });
});

describe("pieceBrief", () => {
  it("carries the statements, the credit and the project id", () => {
    const [piece] = planPieces({ sections: [section("howto", 3)] } as never, "Pricing", "abc").pieces;
    const brief = pieceBrief(piece, { contributor: "Asha", projectId: "p1" });
    expect(brief.sourceNotes).toContain("Statement 2");
    expect(brief.contributor).toBe("Asha");
    expect(brief.sourceProjectId).toBe("p1");
    expect(brief.slug).toBe(piece.key);
  });
});
