import { describe, expect, it } from "vitest";

import { fact, role } from "./fixtures";
import { buildFollowUps, renderFollowUps, renderSourceMapCsv } from "./followups";
import { buildTimeline } from "./timeline";

describe("follow-up questions", () => {
  it("puts conflicts and unsettled sensitive details first, and asks for definitions without inventing any", () => {
    const facts = [
      fact({ category: "kpi", title: "Measure mentioned", statement: "OEE rose by 9 points", details: { definition: null }, reviewStatus: "needs_confirmation" }),
      fact({ category: "case", title: "Dispute", statement: "x", sensitivity: "possible", permission: "unset" }),
      fact({ category: "tool", title: "Tool", statement: "SAP", details: { tool: "SAP", usage: null }, reviewStatus: "needs_confirmation" }),
    ];
    const timeline = buildTimeline([role({ startYear: 2010, endYear: 2001 })]);
    const items = buildFollowUps({ open: [{ roleId: "r", questionKey: "f.rhythm", text: "Walk me through a typical week.", reason: "not yet asked", priority: 7 }], facts, timeline });
    expect(items[0].kind).toBe("fix");
    expect(items.map((i) => i.kind)).toEqual(expect.arrayContaining(["decide", "ask"]));
    expect(items.find((i) => /defined/.test(i.question))?.reason).toMatch(/No targets are inferred/);
    expect(items.map((i) => i.priority)).toEqual([...items.map((i) => i.priority)].sort((a, b) => b - a));
    expect(renderFollowUps(items, "2026-10-25")).toMatch(/^1\. \*\*/m);
  });

  it("escapes the source map CSV", () => {
    expect(renderSourceMapCsv([{ ref: "S1", origin: "interview", quote: 'He said "no".', facts: ["A", "B"] }])).toContain('"He said ""no""."');
  });
});
