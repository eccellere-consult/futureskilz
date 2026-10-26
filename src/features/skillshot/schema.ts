import { z } from "zod";

import { skillTaxonomy } from "../../domain/skills/taxonomy";
import type { Blueprint } from "./types";

/** Validates a Blueprint that came from outside the code (an AI draft or a stored row) before anything renders or scores it. */
const known = new Set(skillTaxonomy.map((skill) => skill.slug));
const str = (max = 1200) => z.string().max(max);
const option = z.object({ id: str(20), text: str(400), feedback: str(600) });
const interaction = z.object({ prompt: str(600), context: str(400).optional(), options: z.array(option).min(2).max(5), correctId: str(20), thinkSeconds: z.number().min(0).max(60), rationale: str(700) });

const visual = z.discriminatedUnion("type", [
  z.object({ type: z.literal("case-card"), heading: str(120), facts: z.array(str(200)).max(8), label: str(160).optional() }),
  z.object({ type: z.literal("compare"), leftTitle: str(80), rightTitle: str(80), rows: z.array(z.tuple([str(120), str(200), str(200)])).max(8) }),
  z.object({ type: z.literal("steps"), items: z.array(str(240)).max(8) }),
  z.object({ type: z.literal("why-chain"), problem: str(240), links: z.array(z.object({ why: str(200), because: str(300) })).max(8), root: str(400).optional() }),
  z.object({ type: z.literal("checklist"), title: str(120), items: z.array(str(240)).max(10) }),
  z.object({ type: z.literal("takeaways"), items: z.array(str(240)).max(6) }),
]);

const scene = z.object({
  id: str(40),
  section: z.enum(["hook", "outcome", "concept", "method", "application", "challenge", "summary"]),
  purpose: str(300),
  title: str(120),
  onScreen: z.array(str(200)).max(6),
  visual: visual.optional(),
  narration: str(2400),
  pauseSeconds: z.number().min(0).max(20),
  cue: z.enum(["greet", "point", "pause", "none"]),
  interaction: interaction.optional(),
  accessibility: str(400),
  sources: z.array(str(20)).max(6),
});

export const blueprintSchema = z.object({
  meta: z.object({
    id: str(80),
    title: str(160),
    version: str(20),
    domain: str(120),
    industry: str(120).optional(),
    functionName: str(160).optional(),
    role: str(160).optional(),
    targetAudience: str(300),
    proficiency: z.enum(["foundational", "working", "advanced"]),
    language: str(60),
    teachingPattern: z.enum(["A", "B", "C", "D", "E", "F"]),
    patternReason: str(600),
    prerequisites: z.array(str(300)).max(5),
    parentSkill: str(160),
    relatedSkillShots: z.array(str(80)).max(6),
    contributorAttribution: str(300),
    reviewStatus: z.enum(["draft", "in_review", "approved", "published"]),
    skillMap: z.array(z.object({ skill: z.string().refine((slug) => known.has(slug), "Unknown skill"), toLevel: z.number().min(0.5).max(5) })).max(6),
  }),
  design: z.object({
    learningNeed: str(600),
    learningObjective: str(400),
    successCriteria: z.array(str(300)).max(6),
    caseContext: str(800),
    keyConcept: str(900),
    methodOrFramework: str(900),
    stepByStepApplication: z.array(str(400)).max(10),
    workedExample: str(900),
    commonMistakes: z.array(str(300)).max(8),
    limitationsAndCaveats: z.array(str(400)).max(6),
    learnerChallenge: str(600),
    workplaceTransferTask: str(800),
    summaryTakeaways: z.array(str(300)).max(5),
    nextLearningRecommendation: z.array(z.object({ label: str(160), href: str(200).optional(), why: str(300) })).max(5),
  }),
  disclosure: str(800),
  scenes: z.array(scene).min(3).max(12),
  knowledgeCheck: z.array(z.object({ id: str(20), prompt: str(400), options: z.array(option).min(2).max(5), correctId: str(20), why: str(500) })).max(6),
  sources: z.array(z.object({ id: str(20), kind: z.enum(["illustrative", "method", "product", "design", "expert-interview", "document"]), label: str(240), where: str(200).optional() })).max(12),
  learningPath: z.object({ skillSet: str(160), capabilityModule: str(160), rolePath: str(160), position: str(300) }),
});

export type ParsedBlueprint = { ok: true; blueprint: Blueprint } | { ok: false; errors: string[] };

/** Pulls the JSON out of a model reply (it may arrive in a code fence) and checks it against the schema. */
export function parseBlueprint(raw: unknown): ParsedBlueprint {
  let value = raw;
  if (typeof raw === "string") {
    const text = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start < 0 || end <= start) return { ok: false, errors: ["No JSON object found."] };
    try {
      value = JSON.parse(text.slice(start, end + 1));
    } catch {
      return { ok: false, errors: ["The reply was not valid JSON."] };
    }
  }
  const parsed = blueprintSchema.safeParse(value);
  if (!parsed.success) return { ok: false, errors: parsed.error.issues.slice(0, 12).map((issue) => `${issue.path.join(".")}: ${issue.message}`) };
  const choice = (ids: string[], id: string) => ids.includes(id);
  const blueprint = parsed.data as Blueprint;
  const problems: string[] = [];
  for (const item of blueprint.scenes) if (item.interaction && !choice(item.interaction.options.map((o) => o.id), item.interaction.correctId)) problems.push(`${item.id}: correctId is not one of the options.`);
  for (const q of blueprint.knowledgeCheck) if (!choice(q.options.map((o) => o.id), q.correctId)) problems.push(`${q.id}: correctId is not one of the options.`);
  return problems.length ? { ok: false, errors: problems } : { ok: true, blueprint };
}
