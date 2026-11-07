import { describe, expect, it } from "vitest";

import { buildExtractionMessages, careerFactFromRole, extractByRules, extractFollowUp, parseJsonLoose, validateAiFacts } from "./extraction";
import { role, seg } from "./fixtures";
import { getQuestion } from "./question-bank";
import { quoteAppearsIn, unsupportedNumbers, yearSpans } from "./signals";

describe("rule-based extraction", () => {
  it("keeps the expert's words and links them to the segment", () => {
    const segment = seg("First we checked demand, then we scheduled the lines using SAP. We cut scrap by 18% in two quarters.", { id: "seg-a", seq: 7 });
    const facts = extractByRules({ segment, question: getQuestion("g.steps")!, roleId: "r1", processId: "p1", processLabel: "Daily scheduling", depthOk: true });
    const main = facts[0];
    expect(main.category).toBe("practice");
    expect(main.kind).toBe("direct_statement");
    expect(main.statement).toContain("scheduled the lines");
    expect(main.sources[0]).toMatchObject({ segmentId: "seg-a" });
    expect(quoteAppearsIn(main.sources[0].quote, segment.text)).toBe(true);
    expect(main.reviewStatus).toBe("proposed");
  });

  it("records a named tool and a measure as unconfirmed, low-confidence facts without inventing details", () => {
    const segment = seg("We used SAP daily. Scrap fell by 18% after the change.", { id: "seg-b" });
    const facts = extractByRules({ segment, question: getQuestion("f.tools")!, roleId: null, processId: null, depthOk: true });
    const tool = facts.find((f) => f.category === "tool" && f.details?.tool === "SAP");
    const kpi = facts.find((f) => f.category === "kpi");
    expect(tool).toMatchObject({ confidence: "low", reviewStatus: "needs_confirmation" });
    expect(tool?.details?.usage).toBeNull();
    expect(kpi?.details).toMatchObject({ definition: null, baseline: null, target: null, result: null });
  });

  it("never extracts from the companion's own words", () => {
    const segment = seg("Could you give me an example?", { speaker: "companion" });
    expect(extractByRules({ segment, question: getQuestion("f.tools")!, roleId: null, processId: null, depthOk: true })).toEqual([]);
  });

  it("flags possibly sensitive text", () => {
    const segment = seg("The confidential client contract was handled by my manager Rajesh Kumar.", { id: "seg-c" });
    const [fact] = extractByRules({ segment, question: getQuestion("k.success")!, roleId: null, processId: null, depthOk: true });
    expect(fact.sensitivity).toBe("possible");
  });

  it("turns a follow-up answer into a fact of the right kind", () => {
    const segment = seg("Scrap rate is scrapped units over total units, reported monthly.", { id: "seg-d" });
    const [fact] = extractFollowUp("metric", segment, "r1", null, "Measure mentioned");
    expect(fact.category).toBe("kpi");
    expect(fact.sources[0].segmentId).toBe("seg-d");
  });

  it("drafts a career fact from a confirmed role", () => {
    const segment = seg("1998-2004 Planner at Acme Steel", { id: "seg-e" });
    const fact = careerFactFromRole(role({ id: "r1", startYear: 1998, endYear: 2004, datesApproximate: true }), segment, "1998-2004 Planner at Acme Steel");
    expect(fact.statement).toContain("about 1998 to 2004");
    expect(fact.reviewStatus).toBe("confirmed");
  });
});

describe("AI extraction validation", () => {
  const segments = [seg("We introduced a daily huddle with the maintenance team and downtime fell by 12 percent over the year.", { id: "seg-1" })];
  const good = { category: "practice", kind: "direct_statement", title: "Daily huddle", statement: "A daily huddle with maintenance reduced downtime by 12 percent.", segmentId: "seg-1", quote: "a daily huddle with the maintenance team and downtime fell by 12 percent", confidence: "high" };

  it("accepts a grounded fact and keeps it as an unconfirmed proposal", () => {
    const { accepted, rejected } = validateAiFacts({ facts: [good] }, segments, { roleId: "r1", processId: null });
    expect(rejected).toEqual([]);
    expect(accepted[0]).toMatchObject({ reviewStatus: "proposed", machineExtracted: true, roleId: "r1" });
  });

  it("rejects a quote that is not in the segment", () => {
    const { accepted, rejected } = validateAiFacts({ facts: [{ ...good, quote: "we hired three engineers" }] }, segments, { roleId: null, processId: null });
    expect(accepted).toHaveLength(0);
    expect(rejected[0].reason).toBe("quote_not_found");
  });

  it("rejects an invented number", () => {
    const { accepted, rejected } = validateAiFacts({ facts: [{ ...good, statement: "Downtime fell by 40 percent.", quote: "downtime fell by 12 percent" }] }, segments, { roleId: null, processId: null });
    expect(accepted).toHaveLength(0);
    expect(rejected[0]).toMatchObject({ reason: "unsupported_number", detail: "40" });
  });

  it("rejects a segment it was never given and the companion's own words", () => {
    const withCompanion = [...segments, seg("What did you do next?", { id: "seg-2", speaker: "companion" })];
    const unknown = validateAiFacts({ facts: [{ ...good, segmentId: "nope" }] }, withCompanion, { roleId: null, processId: null });
    expect(unknown.rejected[0].reason).toBe("unknown_segment");
    const speaker = validateAiFacts({ facts: [{ ...good, segmentId: "seg-2", quote: "What did you do next" }] }, withCompanion, { roleId: null, processId: null });
    expect(speaker.rejected[0].reason).toBe("speaker");
  });

  it("marks an AI synthesis as needing the contributor's confirmation", () => {
    const { accepted } = validateAiFacts({ facts: [{ ...good, kind: "ai_synthesis" }] }, segments, { roleId: null, processId: null });
    expect(accepted[0]).toMatchObject({ kind: "ai_synthesis", reviewStatus: "needs_confirmation", confidence: "low" });
  });

  it("reads JSON wrapped in code fences", () => {
    expect(parseJsonLoose('Here you go:\n```json\n{"facts":[]}\n```')).toEqual({ facts: [] });
    expect(() => parseJsonLoose("no json")).toThrow();
  });

  it("builds a prompt that forbids invention and carries segment ids", () => {
    const [system, user] = buildExtractionMessages({ segments, question: "What did you do?", categories: ["practice"] });
    expect(system.content).toMatch(/Never add/);
    expect(user.content).toContain("segmentId=seg-1");
  });
});

describe("signals", () => {
  it("does not mistake an employer for a tool", async () => {
    const { namedTools } = await import("./signals");
    expect(namedTools("Later I worked as Plant Head with Bharat Forge in Pune.")).toEqual([]);
    expect(namedTools("We tracked it using Tableau every week.")).toEqual(["Tableau"]);
  });
  it("reads year ranges, approximate dates and ongoing roles", () => {
    expect(yearSpans("1998-2004 and about 2005 to 2011, then 2012 to present")).toMatchObject([
      { start: 1998, end: 2004, approximate: false },
      { start: 2005, end: 2011, approximate: true },
      { start: 2012, end: null, ongoing: true },
    ]);
  });
  it("catches figures that are not in the quote", () => {
    expect(unsupportedNumbers("Saved 1,200 hours across 15 plants", "saved 1200 hours")).toEqual(["15"]);
  });
});
