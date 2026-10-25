import { describe, expect, it } from "vitest";

import { fact, role, seg } from "./fixtures";
import { evaluateLessonGates, evaluatePackageGates, blockingFailures, REQUIRED_CONSENTS, type ConsentState } from "./gates";
import { buildKnowledgePackage, publishableText, sectionOf } from "./knowledge-package";
import { blueprintLessons, buildLearningPaths, checkLesson, recommendEntries } from "./lessons";
import { renderSkillMd, skillName, type SkillMeta } from "./skill-md";
import { buildTimeline } from "./timeline";
import { renderTranscript } from "./transcript";

const segments = [
  seg("First we checked demand, then we scheduled the lines, then we released orders.", { id: "seg-1", seq: 1 }),
  seg("The internal client list was confidential, so I will not name the buyers.", { id: "seg-2", seq: 2 }),
  seg("Scrap rate is scrapped units over total units, monthly.", { id: "seg-3", seq: 3 }),
];
const R = role({ id: "r1" });

const facts = [
  fact({ id: "f1", category: "practice", title: "Steps", statement: segments[0].text, roleId: "r1", processId: "p1", details: { questionKey: "g.steps", process: "Daily scheduling", steps: ["First we checked demand.", "Then we scheduled the lines.", "Then we released orders."] }, sources: [{ segmentId: "seg-1", quote: segments[0].text }] }),
  fact({ id: "f2", category: "mistake", title: "Exceptions", statement: "Rush orders break the freeze window; escalate to the plant head before changing the schedule.", roleId: "r1", processId: "p1", details: { questionKey: "g.exceptions", process: "Daily scheduling" }, sources: [{ segmentId: "seg-1", quote: "released orders" }] }),
  fact({ id: "f3", category: "kpi", title: "Scrap", statement: segments[2].text, roleId: "r1", details: { questionKey: "h.kpis", definition: "scrapped over total", baseline: null }, sources: [{ segmentId: "seg-3", quote: segments[2].text }] }),
  fact({ id: "f4", category: "case", title: "Client dispute", statement: "A confidential dispute with a named buyer.", sensitivity: "possible", permission: "unset", sources: [{ segmentId: "seg-2", quote: segments[1].text }] }),
  fact({ id: "f5", category: "tool", title: "Tool", statement: "Mentions SAP.", reviewStatus: "needs_confirmation", permission: "unset", sources: [{ segmentId: "seg-1", quote: "scheduled" }] }),
  fact({ id: "f6", category: "case", title: "Story", statement: "We lost a major buyer in 2009 after a late shipment.", permission: "anonymize", anonymizedStatement: "A major buyer was lost after a late shipment.", sources: [{ segmentId: "seg-2", quote: "confidential" }] }),
  fact({ id: "f7", category: "practice", title: "Rejected", statement: "Wrong.", reviewStatus: "rejected" }),
];

describe("knowledge package", () => {
  it("routes facts to the specification sections by the question that produced them", () => {
    expect(sectionOf(facts[0])).toBe("howto");
    expect(sectionOf(facts[2])).toBe("kpis");
    expect(sectionOf({ category: "tool", details: null })).toBe("tools");
  });

  it("publishes only confirmed, cleared facts, using approved anonymised wording", () => {
    const pkg = buildKnowledgePackage({ facts, segments, mode: "publish" });
    const text = pkg.sections.flatMap((s) => s.items).map((i) => i.text).join(" ");
    expect(text).toContain("scheduled the lines");
    expect(text).toContain("A major buyer was lost");
    expect(text).not.toContain("named buyer");
    expect(text).not.toContain("2009");
    expect(pkg.withheld.map((w) => w.factId)).toEqual(expect.arrayContaining(["f4", "f5", "f7"]));
    expect(pkg.withheld.find((w) => w.factId === "f4")?.reason).toMatch(/sensitive/);
  });

  it("does not carry the original quote of an anonymised fact into a publication", () => {
    const pkg = buildKnowledgePackage({ facts, segments, mode: "publish" });
    expect(pkg.sourceMap.some((s) => s.quote.includes("confidential"))).toBe(false);
  });

  it("holds back an anonymised fact that has no approved wording", () => {
    expect(publishableText({ permission: "anonymize", statement: "x", anonymizedStatement: null })).toBeNull();
    expect(publishableText({ permission: "private", statement: "x", anonymizedStatement: null })).toBeNull();
    expect(publishableText({ permission: "unset", statement: "x", anonymizedStatement: null })).toBeNull();
  });

  it("shows everything but rejected facts in a draft, with their review status", () => {
    const pkg = buildKnowledgePackage({ facts, segments, mode: "draft" });
    expect(pkg.stats.included).toBe(6);
    expect(pkg.stats.unconfirmed).toBe(1);
    expect(pkg.withheld.map((w) => w.factId)).toEqual(["f7"]);
  });
});

const meta = (status: SkillMeta["status"] = "draft"): SkillMeta => ({
  title: "Production planning", slug: skillName("Asha Rao", "production planning"), version: "1.0", status, generatedAt: "2026-10-25T10:00:00.000Z",
  contributorName: "Asha Rao", showProfile: true, roles: [R], timeline: buildTimeline([R]), openQuestions: [{ roleId: "r1", questionKey: "f.rhythm", text: "Walk me through a typical week.", reason: "not yet asked", priority: 7 }],
  uploads: [{ filename: "cv.pdf", status: "extracted", ownership: "mine" }], consents: REQUIRED_CONSENTS.map((purpose) => ({ purpose, granted: true })),
});

describe("skill.md", () => {
  it("has front matter, review status, source references and all 19 sections", () => {
    const skill = fact({ id: "f8", category: "skill", title: "Scheduling judgement", statement: "Balancing load against changeover cost.", reviewStatus: "proposed", details: { questionKey: "n.skills" }, sources: [{ segmentId: "seg-1", quote: "scheduled the lines" }] });
    const md = renderSkillMd(buildKnowledgePackage({ facts: [...facts, skill], segments, mode: "draft" }), meta("awaiting-contributor-review"));
    expect(md.startsWith("---\nname: futureskilz-asha-rao-production-planning")).toBe(true);
    expect(md).toContain("status: awaiting-contributor-review");
    for (let i = 1; i <= 19; i += 1) expect(md).toMatch(new RegExp(`^## ${i}\\. `, "m"));
    expect(md).toMatch(/\[S1\]/);
    expect(md).toContain("not yet reviewed");
    expect(md).toContain("Proposed mapping for review");
    expect(md).toContain("Open questions");
  });

  it("states unknown KPI details as not stated rather than inventing them", () => {
    const md = renderSkillMd(buildKnowledgePackage({ facts, segments, mode: "draft" }), meta());
    expect(md).toMatch(/Not stated: baseline/);
  });

  it("leaves the profile out when the contributor has not consented to being named", () => {
    const md = renderSkillMd(buildKnowledgePackage({ facts, segments, mode: "publish" }), { ...meta("published"), showProfile: false });
    expect(md).toContain("withheld");
    expect(md).not.toContain("Asha Rao");
  });
});

describe("transcript", () => {
  it("keeps session boundaries, speakers and relative timestamps; corrections are listed apart", () => {
    const text = renderTranscript({
      contributorName: "Asha Rao", projectTitle: "Planning", exportedAt: "2026-10-25T12:00:00Z", uploads: [{ id: "u1", filename: "cv.pdf" }],
      sessions: [{ id: "s1", number: 1, startedAt: "2026-10-25T10:00:00Z", endedAt: "2026-10-25T10:30:00Z", segments: [
        seg("Tell me about your first job.", { speaker: "companion", createdAt: "2026-10-25T10:00:05Z" }),
        seg("I began in 1996.", { createdAt: "2026-10-25T10:01:10Z" }),
        seg("Correction: it was 1997.", { source: "correction", createdAt: "2026-10-26T09:00:00Z" }),
      ] }],
    });
    expect(text).toContain("==== SESSION 1");
    expect(text).toContain("[00:00:05] Companion (AI): Tell me");
    expect(text).toContain("[00:01:10] Contributor: I began in 1996.");
    expect(text).toContain("CONTRIBUTOR CORRECTIONS");
    expect(text.indexOf("CORRECTIONS")).toBeGreaterThan(text.indexOf("END OF SESSION 1"));
  });
});

const allConsents: ConsentState = Object.fromEntries(REQUIRED_CONSENTS.map((p) => [p, true]));
const gateInput = (patch = {}) => ({
  consents: allConsents, facts, uploads: [{ filename: "cv.pdf", extractionStatus: "extracted", ownership: "mine" }],
  timeline: buildTimeline([R]), contributorApproved: true, mode: "publish" as const, segmentsExist: new Set(segments.map((s) => s.id)), ...patch,
});

describe("publication gates", () => {
  it("blocks publication until sensitive facts are settled, and lists unreviewed facts without blocking on them", () => {
    const gates = evaluatePackageGates(gateInput());
    expect(blockingFailures(gates).map((g) => g.id)).toContain("confidentiality");
    const review = gates.find((g) => g.id === "review")!;
    expect(review).toMatchObject({ passed: false, blocking: false });
    expect(review.detail).toMatch(/stay out of anything published/);
  });

  it("passes when everything is confirmed, sourced, consented and approved", () => {
    const clean = facts.filter((f) => f.id !== "f4" && f.id !== "f5" && f.id !== "f7").concat([1, 2, 3].map((n) => fact({ id: `x${n}`, statement: `Extra ${n}`, sources: [{ segmentId: "seg-1", quote: "x" }] })));
    expect(blockingFailures(evaluatePackageGates(gateInput({ facts: clean })))).toEqual([]);
  });

  it("fails without consent, with unreadable uploads, unclaimed rights or a claim with no source", () => {
    const failed = blockingFailures(evaluatePackageGates(gateInput({
      consents: { recording: true }, uploads: [{ filename: "scan.pdf", extractionStatus: "failed", ownership: "unknown" }],
      facts: [fact({ statement: "x", sources: [] })], contributorApproved: false,
    }))).map((g) => g.id);
    expect(failed).toEqual(expect.arrayContaining(["consent", "sources_processed", "rights", "traceability", "approval"]));
  });

  it("requires a date conflict to be resolved", () => {
    const bad = buildTimeline([role({ startYear: 2010, endYear: 2001 })]);
    expect(blockingFailures(evaluatePackageGates(gateInput({ timeline: bad }))).map((g) => g.id)).toContain("contradictions");
  });

  it("requires attribution to add up and separate consent for a synthetic voice", () => {
    const base = { packageApproved: true, consents: allConsents, usesSyntheticVoice: true, issues: [], hasCaptions: true, editorApproved: true, contributorApproved: true, attributionBasisPoints: 9000, contributorCount: 1, factsPublishable: true };
    const failed = blockingFailures(evaluateLessonGates(base)).map((g) => g.id);
    expect(failed).toEqual(["voice", "attribution"]);
    expect(blockingFailures(evaluateLessonGates({ ...base, usesSyntheticVoice: false, attributionBasisPoints: 10000 }))).toEqual([]);
  });
});

describe("lessons", () => {
  const pkg = buildKnowledgePackage({ facts, segments, mode: "publish" });
  const { lessons, skipped } = blueprintLessons(pkg, { contributor: "Asha Rao", roles: [R], now: "2026-10-25T10:00:00Z" });

  it("builds a how-to lesson from confirmed facts only, with scenes, narration, a check and sources", () => {
    const howTo = lessons.find((l) => l.title.startsWith("How to"));
    expect(howTo).toBeDefined();
    expect(howTo!.objective.split(" ")[0]).toBe("Apply");
    expect(howTo!.scenes.map((s) => s.kind)).toEqual(expect.arrayContaining(["title", "concept", "steps", "check", "summary"]));
    expect(howTo!.scenes.every((s) => s.onScreen.length <= 5)).toBe(true);
    expect(howTo!.factIds).toContain("f1");
    expect(howTo!.factIds).not.toContain("f4");
    expect(howTo!.check.demonstration === null || typeof howTo!.check.demonstration === "string").toBe(true);
    expect(howTo!.narration.join(" ")).not.toContain("confidential");
    expect(checkLesson(howTo!, pkg.sections.flatMap((s) => s.items).map((i) => i.text))).toEqual([]);
  });

  it("reports topics it could not teach from instead of guessing", () => {
    const noSteps = buildKnowledgePackage({ facts: [facts[1]], segments, mode: "publish" });
    const out = blueprintLessons(noSteps, { contributor: "Asha Rao", roles: [R], now: "x" });
    expect(out.lessons.filter((l) => l.stage === "process")).toHaveLength(0);
    expect(out.skipped[0].reason).toMatch(/step-by-step/);
    expect(skipped).toBeDefined();
  });

  it("flags a lesson with an invented figure, a weak objective or no sources", () => {
    const howTo = lessons.find((l) => l.title.startsWith("How to"))!;
    const bad = { ...howTo, objective: "Understand scheduling", factIds: [], narration: [...howTo.narration, "This saved 450 hours."] };
    const ids = checkLesson(bad, ["First we checked demand."]).map((i) => i.id);
    expect(ids).toEqual(expect.arrayContaining(["objective", "sources", "numbers"]));
  });

  it("orders paths from context to advanced and never claims completion is mastery", () => {
    const paths = buildLearningPaths(lessons.map((spec) => ({ slug: spec.slug, title: spec.title, spec })));
    expect(paths.length).toBeGreaterThan(0);
    const readiness = paths.find((p) => p.goal === "role_readiness")!;
    expect(readiness.note).toMatch(/not mastery/);
    const stages = readiness.entries.map((e) => e.stage);
    expect([...stages]).toEqual([...stages].sort((a, b) => ["context", "function", "role", "process", "tools", "practice", "exceptions", "assessment", "advanced"].indexOf(a) - ["context", "function", "role", "process", "tools", "practice", "exceptions", "assessment", "advanced"].indexOf(b)));
    const rec = recommendEntries(readiness, [readiness.entries[0].slug]);
    expect(rec.skippable).toHaveLength(1);
    expect(rec.next?.slug).not.toBe(readiness.entries[0].slug);
  });
});
