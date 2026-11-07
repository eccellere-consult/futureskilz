import { describe, expect, it } from "vitest";

import { skillFamilies, skillTaxonomy } from "../../domain/skills/taxonomy";
import { estimateSkills } from "../pathway/estimate";
import { getRole } from "../pathway/roles";
import { scoreAssessment } from "../assessment/model";
import { MAX_PROMPTS, MIN_FAMILIES, familyOrder, nextPrompt, scoreDiagnostic, type DiagnosticAnswer } from "./engine";
import { OUTCOME_OPTIONS, QUESTIONS, SELF_REPORT_CONFIDENCE_CAP } from "./questions";

/** Plays a whole conversation, answering every question with the option at `pick(question)`. */
function converse(pick: (id: string, options: number) => number | null, context = {}, outcome = 2): { answers: DiagnosticAnswer[]; prompts: string[] } {
  const answers: DiagnosticAnswer[] = [];
  const prompts: string[] = [];
  for (let i = 0; i < 40; i += 1) {
    const next = nextPrompt(answers, context);
    if (next.kind === "done") break;
    prompts.push(`${next.kind}:${next.question.id}`);
    if (next.kind === "core") answers.push({ questionId: next.question.id, option: pick(next.question.id, next.question.options.length) });
    else answers.find((answer) => answer.questionId === next.question.id)!.outcome = outcome;
  }
  return { answers, prompts };
}

describe("question bank", () => {
  const slugs = new Set(skillTaxonomy.map((skill) => skill.slug));
  it("is well formed: unique ids, known skills, observable options capped at level 4", () => {
    expect(new Set(QUESTIONS.map((q) => q.id)).size).toBe(QUESTIONS.length);
    for (const q of QUESTIONS) {
      expect(q.prompt.startsWith("Think of"), q.id).toBe(true);
      expect(q.why.length, q.id).toBeGreaterThan(20);
      expect(q.options.length, q.id).toBeGreaterThanOrEqual(4);
      expect(q.options.map((o) => o.level), q.id).toEqual([...q.options.map((o) => o.level)].sort((a, b) => a - b));
      for (const o of q.options) expect(o.level).toBeLessThanOrEqual(4);
      for (const s of q.skills) { expect(slugs.has(s.skill), s.skill).toBe(true); expect(s.weight).toBeGreaterThan(0); expect(s.weight).toBeLessThanOrEqual(1); }
    }
  });
  it("covers every capability family twice, with no family left out", () => {
    for (const family of skillFamilies) expect(QUESTIONS.filter((q) => q.family === family.id).length, family.id).toBe(2);
  });
});

describe("what to ask next", () => {
  it("covers all six families when there is no target role, one question each, without repeating", () => {
    const { prompts } = converse(() => 1);
    const core = prompts.filter((p) => p.startsWith("core:"));
    expect(core).toHaveLength(6);
    expect(new Set(prompts).size).toBe(prompts.length);
    expect(new Set(core.map((p) => QUESTIONS.find((q) => q.id === p.slice(5))!.family)).size).toBe(6);
  });

  it("starts with the families the target role leans on most", () => {
    const role = getRole("ai-product-manager")!;
    const order = familyOrder(role);
    expect(order.slice(0, 2)).toContain("ai-intelligence");
    const first = nextPrompt([], { role });
    expect(first.kind).toBe("core");
    if (first.kind === "core") expect(first.question.family).toBe(order[0]);
  });

  it("asks what came of a strong claim, once per question, and not after a modest answer", () => {
    const strong = converse(() => 3).prompts.filter((p) => p.startsWith("outcome:"));
    expect(strong.length).toBeGreaterThan(0);
    expect(strong.length).toBeLessThanOrEqual(3);
    expect(converse(() => 0).prompts.some((p) => p.startsWith("outcome:"))).toBe(false);
  });

  it("probes a second question where an answer disagrees with the baseline, and only there", () => {
    const strongBaseline = scoreAssessment({ "digital-fluency": 3, "critical-thinking": 3, creativity: 3, "human-skills": 3, "adaptive-leadership": 3 });
    const baseline = estimateSkills(strongBaseline);
    const withConflict = converse(() => 0, { baseline }); // says "I did the least" while the baseline says "strong"
    const without = converse(() => 0, { baseline: estimateSkills(scoreAssessment({ "digital-fluency": 0, "critical-thinking": 0, creativity: 0, "human-skills": 0, "adaptive-leadership": 0 })) });
    expect(withConflict.answers.length).toBeGreaterThan(without.answers.length);
  });

  it("always stops, whatever is answered", () => {
    for (const pick of [() => 0, () => 3, () => null, (_: string, n: number) => n - 1]) {
      const { answers, prompts } = converse(pick, { role: getRole("ai-product-manager")! });
      expect(prompts.length).toBeLessThanOrEqual(MAX_PROMPTS);
      expect(answers.length).toBeGreaterThanOrEqual(MIN_FAMILIES);
    }
  });

  it("is deterministic: the same answers always give the same next question", () => {
    const a = converse((id) => id.length % 4, { role: getRole("operations-manager")! });
    const b = converse((id) => id.length % 4, { role: getRole("operations-manager")! });
    expect(a.prompts).toEqual(b.prompts);
  });
});

describe("scoring", () => {
  it("turns the chosen behaviours into skill levels with honest confidence", () => {
    const result = scoreDiagnostic([{ questionId: "think-recurring-problem", option: 2 }]);
    const ps = result.skills.find((s) => s.skill === "problem-solving")!;
    expect(ps).toMatchObject({ level: 3, kind: "reported-behaviour", answers: 1 });
    expect(ps.confidence).toBeGreaterThan(0.3);
    expect(ps.confidence).toBeLessThan(0.5);
    // A skill touched only lightly carries less confidence than one asked about directly.
    expect(result.skills.find((s) => s.skill === "critical-thinking")!.confidence).toBeLessThan(ps.confidence);
  });

  it("a result raises confidence and labels the evidence", () => {
    const base = scoreDiagnostic([{ questionId: "think-recurring-problem", option: 3 }]).skills.find((s) => s.skill === "problem-solving")!;
    const withResult = scoreDiagnostic([{ questionId: "think-recurring-problem", option: 3, outcome: 2 }]).skills.find((s) => s.skill === "problem-solving")!;
    expect(withResult.confidence).toBeGreaterThan(base.confidence);
    expect(withResult.kind).toBe("reported-behaviour-with-result");
    const unsure = scoreDiagnostic([{ questionId: "think-recurring-problem", option: 3, outcome: 0 }]).skills.find((s) => s.skill === "problem-solving")!;
    expect(unsure.confidence).toBeLessThan(withResult.confidence);
  });

  it("combines answers about the same skill and never claims more than the self-report ceiling", () => {
    const all: DiagnosticAnswer[] = QUESTIONS.map((q) => ({ questionId: q.id, option: q.options.length - 1, outcome: 2 }));
    const result = scoreDiagnostic(all);
    for (const skill of result.skills) expect(skill.confidence).toBeLessThanOrEqual(SELF_REPORT_CONFIDENCE_CAP);
    expect(Math.max(...result.skills.map((s) => s.level))).toBeLessThanOrEqual(4);
    expect(result.skills.find((s) => s.skill === "critical-thinking")!.answers).toBeGreaterThan(1);
  });

  it("treats 'not been in this situation' as no evidence, not a low level", () => {
    const result = scoreDiagnostic([{ questionId: "ai-recent-use", option: null }, { questionId: "think-recurring-problem", option: 2 }]);
    expect(result.noSituation).toEqual(["ai-recent-use"]);
    expect(result.skills.some((s) => s.skill === "ai-literacy")).toBe(false);
  });

  it("ignores unknown questions and out-of-range options", () => {
    const result = scoreDiagnostic([{ questionId: "nope", option: 1 }, { questionId: "think-recurring-problem", option: 9 }]);
    expect(result.skills).toEqual([]);
    expect(OUTCOME_OPTIONS.length).toBeGreaterThan(2);
  });
});
