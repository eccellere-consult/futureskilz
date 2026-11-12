import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { briefSchema } from "@/server/agents/instructional-design";

import { MIN_MATERIAL_CHARS, PART_CHARS, materialBrief, materialSlug, planMaterial, splitMaterial } from "./from-material";
import { LESSON_STANDARD, pointsAtSource } from "./lesson-standard";
import { outlineMaterial } from "./outline";
import { reviewBlueprint } from "./rubric";
import { rootCauseSkillShot } from "./samples/root-cause";

const para = (n: number) => `Paragraph ${n}. `.padEnd(400, "Self awareness means noticing what you feel and why. ");
const body = (topic: string, paragraphs: number) => Array.from({ length: paragraphs }, (_, i) => `${topic} point ${i + 1}. `.padEnd(420, `${topic} is practised by doing one small thing each day and checking the result. `)).join("\n");

const handbook = [
  "Team Communication Handbook",
  "A short guide for new team leads.",
  "",
  "Chapter 1: Listening",
  body("Listening", 5),
  "",
  "Chapter 2: Giving Feedback",
  body("Feedback", 5),
  "",
  "Chapter 3: Running a Meeting",
  body("Meetings", 5),
].join("\n");

describe("outlineMaterial", () => {
  it("finds chapters in the order they are written", () => {
    expect(outlineMaterial(handbook).map((section) => section.title)).toEqual(["Chapter 1: Listening", "Chapter 2: Giving Feedback", "Chapter 3: Running a Meeting"]);
  });
  it("reads numbered, capital and # headings, and puts sections under their chapter", () => {
    const text = ["# Module A", "", "1.1 Why Plans Fail", body("Plans", 5), "", "1.2 The Weekly Review", body("Review", 5), "", "# Module B", "", "SAFETY RULES", body("Safety", 5)].join("\n");
    const sections = outlineMaterial(text);
    expect(sections.map((section) => section.title)).toEqual(["1.1 Why Plans Fail", "1.2 The Weekly Review", "SAFETY RULES"]);
    expect(sections.map((section) => section.group)).toEqual(["Module A", "Module A", "Module B"]);
  });
  it("does not mistake a numbered list or ordinary sentences for headings", () => {
    const list = ["Steps to follow in order", "1. Open the file", "2. Check the date", "3. Save a copy", para(1), para(2)].join("\n");
    expect(outlineMaterial(list)).toEqual([]);
    expect(outlineMaterial(Array.from({ length: 6 }, (_, i) => para(i)).join("\n"))).toEqual([]);
  });
});

describe("planMaterial", () => {
  it("gives nothing for too little text, and one lesson for a short document with no headings", () => {
    expect(planMaterial("too short")).toEqual([]);
    const parts = planMaterial(Array.from({ length: 3 }, (_, i) => para(i)).join("\n"));
    expect(parts).toHaveLength(1);
    expect(parts[0]).toMatchObject({ index: 1, of: 1, structured: false });
  });
  it("makes one lesson per chapter, in order, each knowing the lesson before and after", () => {
    const parts = planMaterial(handbook);
    expect(parts.map((part) => part.title)).toEqual(["Chapter 1: Listening", "Chapter 2: Giving Feedback", "Chapter 3: Running a Meeting"]);
    expect(parts[1]).toMatchObject({ index: 2, of: 3, structured: true, previous: "Chapter 1: Listening", next: "Chapter 3: Running a Meeting" });
    expect(parts[1].text).toContain("Feedback point 1");
    expect(parts[1].text).not.toContain("Listening point");
  });
  it("cuts a long chapter into smaller lessons and joins thin sections, without losing or reordering text", () => {
    const text = ["Chapter 1: Listening", body("Listening", 50), "", "Chapter 2: Short Note", "A thin section. ".repeat(20), "", "Chapter 3: Also Short", "Another thin one. ".repeat(20), "", "Chapter 4: Meetings", body("Meetings", 5)].join("\n");
    const parts = planMaterial(text);
    expect(parts.filter((part) => part.title?.startsWith("Chapter 1: Listening (")).length).toBeGreaterThanOrEqual(2);
    expect(parts.every((part) => part.text.length <= PART_CHARS * 1.35)).toBe(true);
    const order = parts.map((part) => part.text).join("\n");
    expect(order.indexOf("Listening point 1.")).toBeLessThan(order.indexOf("A thin section."));
    expect(order.indexOf("A thin section.")).toBeLessThan(order.indexOf("Another thin one."));
    expect(order.indexOf("Another thin one.")).toBeLessThan(order.indexOf("Meetings point 1."));
    expect(order).toContain("Listening point 50.");
  });
  it("cuts a long document with no headings by size and covers all of it", () => {
    const long = Array.from({ length: 120 }, (_, i) => para(i)).join("\n");
    const parts = planMaterial(long);
    expect(parts.length).toBeGreaterThan(3);
    expect(parts.every((part) => !part.structured && part.text.length <= PART_CHARS + MIN_MATERIAL_CHARS)).toBe(true);
    expect(parts[parts.length - 1].text).toContain("Paragraph 119.");
    expect(splitMaterial(long, 3)).toHaveLength(3);
  });
});

describe("materialBrief", () => {
  it("is a brief the design agent accepts, carrying the reference, the project and the Autopilot mark", () => {
    const [part] = planMaterial(Array.from({ length: 3 }, (_, i) => para(i)).join("\n"));
    const brief = briefSchema.parse(materialBrief(part, { title: "Self awareness slides", contributor: "Asha", projectId: "11111111-2222-3333-4444-555555555555", tag: "11111111" }));
    expect(brief.sourceNotes).toContain("REFERENCE:");
    expect(brief.sourceNotes).toContain("Self awareness means");
    expect(brief.slug).toBe("doc-11111111-1");
    expect(brief.autopilot).toBe(true);
    expect(brief.sourceProjectId).toBe("11111111-2222-3333-4444-555555555555");
  });
  it("names the lesson after its section, says where it sits in the course, and carries the standard", () => {
    const part = planMaterial(handbook)[1];
    const brief = briefSchema.parse(materialBrief(part, { title: "Team handbook", contributor: "Asha", projectId: "p1", tag: "abc12345" }));
    expect(brief.topic).toBe("Chapter 2: Giving Feedback");
    expect(brief.slug).toBe("doc-abc12345-s2");
    expect(materialSlug(part, "abc12345")).toBe(brief.slug);
    expect(brief.sourceNotes).toContain('lesson 2 of 3 in the course "Team handbook"');
    expect(brief.sourceNotes).toContain("FOLLOW THE MATERIAL");
    expect(brief.sourceNotes).toContain("TEACH DIRECTLY");
    expect(brief.sourceNotes).toContain(LESSON_STANDARD[3]);
    expect(brief.sourceNotes).toContain("Feedback point 5");
  });
  it("still makes a valid brief from a very short title", () => {
    const [part] = planMaterial(para(1));
    expect(briefSchema.safeParse(materialBrief(part, { title: "AI", contributor: "Asha", projectId: "p1", tag: "abc12345" })).success).toBe(true);
  });
});

describe("teaching directly", () => {
  it("spots a lesson that talks about its source, and leaves ordinary teaching alone", () => {
    expect(pointsAtSource("According to the document, a brief has three parts.")).toBeTruthy();
    expect(pointsAtSource("The shared content lists four steps.")).toBeTruthy();
    expect(pointsAtSource("As mentioned in the reference material, listen first.")).toBeTruthy();
    expect(pointsAtSource("The PDF explains why plans fail.")).toBeTruthy();
    expect(pointsAtSource("A good brief has three parts. Write them in your notes and keep the document short.")).toBeNull();
  });
  it("fails the check for a lesson that does, and passes the sample lesson", () => {
    expect(reviewBlueprint(rootCauseSkillShot).blockers.join(" ")).not.toContain("Teach the content directly");
    const scenes = rootCauseSkillShot.scenes.map((scene, index) => (index === 2 ? { ...scene, narration: `According to the document, ${scene.narration}` } : scene));
    const review = reviewBlueprint({ ...rootCauseSkillShot, scenes });
    expect(review.passes).toBe(false);
    expect(review.blockers.join(" ")).toContain("Teach the content directly");
  });
});

describe("the lesson standard", () => {
  it("is written word for word in the project's instructions", () => {
    const instructions = readFileSync(join(process.cwd(), "AGENTS.md"), "utf8");
    for (const line of LESSON_STANDARD) expect(instructions).toContain(line);
  });
});
