import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { clock, sceneSeconds, timeline, totalSeconds, wordCount } from "./duration";
import { renderDeliverables } from "./render";
import { reviewBlueprint } from "./rubric";
import { rootCauseSkillShot as blueprint } from "./samples/root-cause";
import type { Blueprint } from "./types";

const clone = (): Blueprint => structuredClone(blueprint);

describe("sample Skill Shot: Find the cause, not just the symptom", () => {
  it("runs 5 to 10 minutes by its own script, with the scenes in teaching order", () => {
    const minutes = totalSeconds(blueprint) / 60;
    expect(minutes).toBeGreaterThanOrEqual(5);
    expect(minutes).toBeLessThanOrEqual(10);
    expect(blueprint.scenes.map((scene) => scene.section)).toEqual(["hook", "outcome", "concept", "method", "application", "challenge", "summary"]);
    const times = timeline(blueprint);
    expect(times[0].start).toBe(0);
    expect(times.at(-1)!.end).toBe(totalSeconds(blueprint));
    expect(clock(125)).toBe("2:05");
    expect(sceneSeconds({ narration: "word ".repeat(145), pauseSeconds: 5, interaction: undefined })).toBe(65);
  });

  it("passes every automatic quality check, and still says a person must review it", () => {
    const review = reviewBlueprint(blueprint);
    expect(review.blockers).toEqual([]);
    expect(review.passes).toBe(true);
    expect(review.humanReviewRequired).toBe(true);
    expect(blueprint.meta.reviewStatus).toBe("draft");
  });

  it("keeps screens short and never makes Arya read a paragraph off the screen", () => {
    for (const scene of blueprint.scenes) {
      expect(wordCount(scene.onScreen.join(" "))).toBeLessThanOrEqual(45);
      expect(scene.narration.length).toBeGreaterThan(scene.onScreen.join(" ").length);
    }
  });

  it("explains every choice in the challenge and the knowledge check, with one correct answer", () => {
    const challenge = blueprint.scenes.find((scene) => scene.interaction)!.interaction!;
    for (const set of [challenge, ...blueprint.knowledgeCheck]) {
      expect(set.options.filter((option) => option.id === set.correctId)).toHaveLength(1);
      for (const option of set.options) expect(option.feedback.length).toBeGreaterThan(20);
    }
  });

  it("is honest about being a draft, an AI teacher and an illustrative case", () => {
    expect(blueprint.disclosure).toMatch(/AI teacher/);
    expect(blueprint.disclosure).toMatch(/synthetic/);
    expect(blueprint.disclosure).toMatch(/made up/);
    expect(blueprint.sources.find((source) => source.kind === "illustrative")).toBeTruthy();
    const card = blueprint.scenes.find((scene) => scene.visual?.type === "case-card")!.visual as { label?: string };
    expect(card.label).toMatch(/Illustrative/);
    expect(blueprint.scenes[0].narration).toMatch(/AI teacher/);
  });
});

describe("quality checks catch real problems", () => {
  it("blocks a lesson with no sources, no AI disclosure, an unlabelled case or the wrong length", () => {
    const noSource = clone();
    noSource.scenes[2].sources = [];
    expect(reviewBlueprint(noSource).blockers.join(" ")).toMatch(/without a source/);

    const noDisclosure = clone();
    noDisclosure.disclosure = "Made by FutureSkilz.";
    expect(reviewBlueprint(noDisclosure).blockers.join(" ")).toMatch(/Disclose that Arya is an AI/);

    const unlabelled = clone();
    (unlabelled.scenes[0].visual as { label?: string }).label = "A case";
    expect(reviewBlueprint(unlabelled).blockers.join(" ")).toMatch(/not labelled as illustrative/);

    const long = clone();
    long.scenes[2].narration = "word ".repeat(1500);
    expect(reviewBlueprint(long).blockers.join(" ")).toMatch(/Estimated length/);
    const short = clone();
    short.scenes = short.scenes.slice(0, 2);
    expect(reviewBlueprint(short).passes).toBe(false);
  });

  it("flags a vague objective and a lesson with no active learning", () => {
    const vague = clone();
    vague.design.learningObjective = "Understand problems better.";
    expect(reviewBlueprint(vague).findings.find((finding) => finding.criterion === "outcome clarity")!.score).toBeLessThan(5);
    const passive = clone();
    passive.scenes = passive.scenes.map((scene) => ({ ...scene, interaction: undefined }));
    expect(reviewBlueprint(passive).findings.find((finding) => finding.criterion === "active learning")!.score).toBeLessThan(4);
  });
});

describe("deliverable documents", () => {
  const files = renderDeliverables(blueprint);
  const dir = path.join(process.cwd(), "docs", "skill-shots", blueprint.meta.id);

  it("makes the seven documents the instructional design skill asks for", () => {
    expect(Object.keys(files).sort()).toEqual(["knowledge_check.md", "learning_path_entry.md", "narration_script.md", "review_checklist.md", "scene_plan.md", "skill_shot_blueprint.md", "source_map.md"]);
    expect(files["narration_script.md"]).toContain("Namaste. I am Arya");
    expect(files["review_checklist.md"]).toContain("A person must still review and approve");
  });

  // Run `UPDATE_DOCS=1 npx vitest run src/features/skillshot` to rewrite the files after changing the blueprint.
  it("keeps the files in docs/skill-shots in step with the blueprint", () => {
    if (process.env.UPDATE_DOCS) {
      mkdirSync(dir, { recursive: true });
      for (const [name, text] of Object.entries(files)) writeFileSync(path.join(dir, name), text);
    }
    for (const [name, text] of Object.entries(files)) expect(readFileSync(path.join(dir, name), "utf8"), `${name} is out of date; run with UPDATE_DOCS=1`).toBe(text);
  });
});
