import { describe, expect, it } from "vitest";

import { rootCauseSkillShot } from "./samples/root-cause";
import { parseBlueprint } from "./schema";

/** A good lesson with the small slips real models make. Before the tidy step each of these discarded the whole reply. */
function slipped(): Record<string, unknown> {
  const draft = JSON.parse(JSON.stringify(rootCauseSkillShot)) as Record<string, Record<string, unknown>> & { scenes: Array<Record<string, unknown>>; knowledgeCheck: Array<Record<string, unknown>> };
  draft.meta.industry = null;
  draft.meta.teachingPattern = "b";
  draft.design.limitationsAndCaveats = "It finds one cause at a time. It depends on honest answers.";
  draft.learningPath.position = 3;
  draft.scenes[0].pauseSeconds = "2";
  draft.scenes[0].cue = "wave";
  draft.scenes[1].visual = { type: "hologram", items: [] };
  draft.meta.prerequisites = null;
  return draft;
}

describe("an AI reply with small slips", () => {
  it("is accepted after tidying, with the teaching kept word for word", () => {
    const parsed = parseBlueprint(JSON.stringify(slipped()));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.blueprint.scenes.map((scene) => scene.narration)).toEqual(rootCauseSkillShot.scenes.map((scene) => scene.narration));
    expect(parsed.blueprint.design.limitationsAndCaveats.length).toBeGreaterThan(0);
    expect(parsed.blueprint.meta.industry).toBeUndefined();
    expect(parsed.blueprint.meta.teachingPattern).toBe("B");
    expect(parsed.blueprint.learningPath.position).toBe("3");
    expect(parsed.blueprint.scenes[0].cue).toBe("none");
  });
  it("accepts a reply wrapped in a code fence", () => {
    expect(parseBlueprint("```json\n" + JSON.stringify(slipped()) + "\n```").ok).toBe(true);
  });
  it("still rejects a reply that is not a lesson at all", () => {
    expect(parseBlueprint("I understand. Let us choose one concrete next step.").ok).toBe(false);
    expect(parseBlueprint(JSON.stringify({ hello: "world" })).ok).toBe(false);
  });
});

describe("tidying a correct blueprint", () => {
  it("changes nothing in it", () => {
    const parsed = parseBlueprint(JSON.stringify(rootCauseSkillShot));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.blueprint).toEqual(JSON.parse(JSON.stringify(rootCauseSkillShot)));
  });
});

describe("the slide parts and diagrams", () => {
  it("keeps subtitle, takeaway and each diagram, and drops a diagram that is not usable", () => {
    const draft = JSON.parse(JSON.stringify(rootCauseSkillShot)) as { scenes: Array<Record<string, unknown>> };
    draft.scenes[0].visual = { type: "cycle", items: ["Plan", "Do", "Check", "Act"], center: "PDCA" };
    draft.scenes[1].visual = { type: "matrix", xAxis: "Effort", yAxis: "Impact", cells: [{ title: "Major project", text: "Plan it" }, { title: "Quick win", text: "Do first" }, { title: "Avoid", text: "Leave" }, { title: "Fill-in", text: "When free" }] };
    draft.scenes[2].visual = { type: "bars", title: "Late orders", unit: "%", bars: [{ label: "Week 1", value: "12" }, { label: "Week 2", value: 9 }] };
    draft.scenes[3].visual = { type: "timeline", items: [{ date: "Week 27", event: "Station added" }, { when: "Week 30", what: "Rework rises" }] };
    draft.scenes[4].visual = { type: "matrix", xAxis: "x", yAxis: "y", cells: [{ title: "only one", text: "cell" }] };
    const parsed = parseBlueprint(JSON.stringify(draft));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const [a, b, c, d, e] = parsed.blueprint.scenes;
    expect(a.subtitle).toBeTruthy();
    expect(a.takeaway).toBeTruthy();
    expect(a.visual).toMatchObject({ type: "cycle", centre: "PDCA" });
    expect(b.visual?.type).toBe("matrix");
    expect(c.visual).toMatchObject({ type: "bars", bars: [{ label: "Week 1", value: 12 }, { label: "Week 2", value: 9 }] });
    expect(d.visual).toMatchObject({ type: "timeline", items: [{ when: "Week 27", what: "Station added" }, { when: "Week 30", what: "Rework rises" }] });
    expect(e.visual).toBeUndefined();
  });
});

describe("the illustrated diagrams", () => {
  it("keeps a hexagon, roadmap, pyramid and funnel, tidying loose field names", () => {
    const draft = JSON.parse(JSON.stringify(rootCauseSkillShot)) as { scenes: Array<Record<string, unknown>> };
    draft.scenes[0].visual = { type: "hexagon", center: "Self awareness", items: ["Emotions", "Strengths", "Triggers", "Feedback"] };
    draft.scenes[1].visual = { type: "roadmap", items: [{ date: "Week 1", what: "Notice" }, { when: "Week 4", title: "Adjust", description: "Change one reaction" }] };
    draft.scenes[2].visual = { type: "pyramid", items: ["Purpose", "Goals", "Plans"] };
    draft.scenes[3].visual = { type: "funnel", stages: ["Enquiries", { title: "Quotes", value: 120 }, { label: "Orders", value: "18" }] };
    draft.scenes[4].visual = { type: "hexagon", centre: "Too few", items: ["One", "Two"] };
    const parsed = parseBlueprint(JSON.stringify(draft));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const [a, b, c, d, e] = parsed.blueprint.scenes;
    expect(a.visual).toMatchObject({ type: "hexagon", centre: "Self awareness" });
    expect(b.visual).toMatchObject({ type: "roadmap", phases: [{ when: "Week 1", title: "Notice" }, { when: "Week 4", title: "Adjust", text: "Change one reaction" }] });
    expect(c.visual).toMatchObject({ type: "pyramid", levels: ["Purpose", "Goals", "Plans"] });
    expect(d.visual).toMatchObject({ type: "funnel", stages: [{ label: "Enquiries" }, { label: "Quotes", value: "120" }, { label: "Orders", value: "18" }] });
    expect(e.visual).toBeUndefined();
  });
});
