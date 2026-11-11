/**
 * Tidies an AI's draft into the blueprint's exact shape before it is checked. A model often gets the lesson right and one small
 * field wrong: `null` where text is expected, one sentence where a list is expected, a number written as text, a line a little
 * too long. Rejecting the whole lesson for that throws good teaching away, so each field is gently put into the shape the
 * blueprint needs: text stays text, lists stay lists, anything beyond the limits is trimmed, and a part that cannot be
 * understood at all (a broken picture or question) is left out rather than failing everything. The words themselves are never
 * rewritten here, and the quality checks still run afterwards on the result.
 */
type Any = Record<string, unknown>;

const isObject = (value: unknown): value is Any => typeof value === "object" && value !== null && !Array.isArray(value);
const obj = (value: unknown): Any => (isObject(value) ? value : {});

function text(value: unknown, max: number): string {
  if (typeof value === "string") return value.trim().slice(0, max);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map((item) => text(item, max)).filter(Boolean).join("; ").slice(0, max);
  if (isObject(value)) return text(value.text ?? value.label ?? value.title ?? value.description ?? Object.values(value).filter((item) => typeof item === "string").join(". "), max);
  return "";
}
const optional = (value: unknown, max: number): string | undefined => text(value, max) || undefined;

function list(value: unknown, maxItems: number, maxChars: number): string[] {
  const items = Array.isArray(value) ? value : typeof value === "string" ? value.split(/\n+|;\s+/) : value == null ? [] : [value];
  return items.map((item) => text(item, maxChars).replace(/^(?:[-•*]\s+|\d+[.)]\s+)/, "")).filter(Boolean).slice(0, maxItems);
}

function number(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number.parseFloat(value) : Number.NaN;
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  const wanted = text(value, 60).toLowerCase().replace(/[\s_]+/g, "-");
  return allowed.find((item) => item.toLowerCase() === wanted) ?? allowed.find((item) => wanted.startsWith(item.toLowerCase())) ?? fallback;
}

const SECTIONS = ["hook", "outcome", "concept", "method", "application", "challenge", "summary"] as const;
const SECTION_WORDS: Record<string, (typeof SECTIONS)[number]> = { problem: "hook", intro: "hook", introduction: "hook", opening: "hook", objective: "outcome", goal: "outcome", idea: "concept", explanation: "concept", framework: "method", steps: "method", demonstration: "method", example: "application", case: "application", practice: "challenge", exercise: "challenge", quiz: "challenge", recap: "summary", close: "summary", closing: "summary", takeaways: "summary", conclusion: "summary" };

function options(value: unknown): Array<{ id: string; text: string; feedback: string }> {
  return (Array.isArray(value) ? value : []).slice(0, 5).map((item, index) => {
    const option = obj(item);
    return { id: text(option.id, 20) || String.fromCharCode(97 + index), text: text(option.text ?? (typeof item === "string" ? item : ""), 400), feedback: text(option.feedback ?? option.explanation, 600) };
  }).filter((option) => option.text);
}

/** The id of the right answer, matched loosely: by id, by position ("1", "B") or by the option's own text. */
function correct(value: unknown, choices: Array<{ id: string; text: string }>): string {
  const wanted = text(value, 400);
  const byId = choices.find((choice) => choice.id.toLowerCase() === wanted.toLowerCase());
  if (byId) return byId.id;
  const position = /^\d+$/.test(wanted) ? Number(wanted) - 1 : /^[a-e]$/i.test(wanted) ? wanted.toLowerCase().charCodeAt(0) - 97 : -1;
  if (choices[position]) return choices[position].id;
  return choices.find((choice) => choice.text.toLowerCase() === wanted.toLowerCase())?.id ?? wanted.slice(0, 20);
}

function interaction(value: unknown): Any | undefined {
  if (!isObject(value)) return undefined;
  const choices = options(value.options);
  if (choices.length < 2) return undefined;
  return { prompt: text(value.prompt ?? value.question, 600), ...(optional(value.context, 400) ? { context: optional(value.context, 400) } : {}), options: choices, correctId: correct(value.correctId ?? value.correct ?? value.answer, choices), thinkSeconds: number(value.thinkSeconds, 0, 60, 6), rationale: text(value.rationale ?? value.why, 700) };
}

function visual(value: unknown): Any | undefined {
  if (!isObject(value)) return undefined;
  const type = pick(value.type, ["case-card", "compare", "steps", "why-chain", "checklist", "takeaways", "flow", "cycle", "matrix", "bars", "timeline", "hexagon", "roadmap", "pyramid", "funnel"] as const, "steps");
  if (type === "hexagon") {
    const items = list(value.items ?? value.parts, 6, 48);
    return items.length >= 3 ? { type, centre: text(value.centre ?? value.center ?? value.title, 40), items } : undefined;
  }
  if (type === "roadmap") {
    const phases = (Array.isArray(value.phases) ? value.phases : Array.isArray(value.items) ? value.items : []).slice(0, 5).map((phase) => ({ when: text(obj(phase).when ?? obj(phase).date, 40), title: text(obj(phase).title ?? obj(phase).what, 60), ...(optional(obj(phase).text ?? obj(phase).description, 140) ? { text: optional(obj(phase).text ?? obj(phase).description, 140) } : {}) })).filter((phase) => phase.title);
    return phases.length >= 2 ? { type, phases } : undefined;
  }
  if (type === "pyramid") {
    const levels = list(value.levels ?? value.items, 5, 110);
    return levels.length >= 3 ? { type, levels } : undefined;
  }
  if (type === "funnel") {
    const stages = (Array.isArray(value.stages) ? value.stages : Array.isArray(value.items) ? value.items : []).slice(0, 5).map((stage) => (isObject(stage) ? { label: text(stage.label ?? stage.title, 90), ...(optional(stage.value, 24) ? { value: optional(stage.value, 24) } : {}) } : { label: text(stage, 90) })).filter((stage) => stage.label);
    return stages.length >= 3 ? { type, stages } : undefined;
  }
  if (type === "flow") {
    const items = list(value.items ?? value.steps, 6, 120);
    return items.length >= 2 ? { type, items } : undefined;
  }
  if (type === "cycle") {
    const items = list(value.items ?? value.steps, 6, 80);
    return items.length >= 3 ? { type, items, ...(optional(value.centre ?? value.center, 60) ? { centre: optional(value.centre ?? value.center, 60) } : {}) } : undefined;
  }
  if (type === "matrix") {
    const cells = (Array.isArray(value.cells) ? value.cells : []).slice(0, 4).map((cell) => ({ title: text(obj(cell).title ?? obj(cell).label, 60), text: text(obj(cell).text ?? obj(cell).description, 160) }));
    return cells.length === 4 ? { type, xAxis: text(value.xAxis, 80), yAxis: text(value.yAxis, 80), cells } : undefined;
  }
  if (type === "bars") {
    const bars = (Array.isArray(value.bars) ? value.bars : []).slice(0, 7).map((bar) => ({ label: text(obj(bar).label, 60), value: number(obj(bar).value, 0, 1_000_000_000, Number.NaN) })).filter((bar) => bar.label && Number.isFinite(bar.value));
    return bars.length >= 2 ? { type, title: text(value.title, 120), ...(optional(value.unit, 20) ? { unit: optional(value.unit, 20) } : {}), bars } : undefined;
  }
  if (type === "timeline") {
    const items = (Array.isArray(value.items) ? value.items : []).slice(0, 6).map((item) => ({ when: text(obj(item).when ?? obj(item).date, 40), what: text(obj(item).what ?? obj(item).event ?? obj(item).text, 160) })).filter((item) => item.what);
    return items.length >= 2 ? { type, items } : undefined;
  }
  if (type === "case-card") return { type, heading: text(value.heading ?? value.title, 120), facts: list(value.facts ?? value.items, 8, 200), ...(optional(value.label, 160) ? { label: optional(value.label, 160) } : {}) };
  if (type === "compare") {
    const rows = (Array.isArray(value.rows) ? value.rows : []).slice(0, 8).map((row) => (Array.isArray(row) ? row : isObject(row) ? Object.values(row) : [])).filter((row) => row.length >= 3).map((row) => [text(row[0], 120), text(row[1], 200), text(row[2], 200)]);
    return rows.length ? { type, leftTitle: text(value.leftTitle, 80), rightTitle: text(value.rightTitle, 80), rows } : undefined;
  }
  if (type === "why-chain") {
    const links = (Array.isArray(value.links) ? value.links : []).slice(0, 8).map((link) => ({ why: text(obj(link).why, 200), because: text(obj(link).because, 300) })).filter((link) => link.why || link.because);
    return links.length ? { type, problem: text(value.problem, 240), links, ...(optional(value.root, 400) ? { root: optional(value.root, 400) } : {}) } : undefined;
  }
  if (type === "checklist") return { type, title: text(value.title ?? value.heading, 120), items: list(value.items, 10, 240) };
  const items = list(value.items ?? value.steps ?? value.points, type === "takeaways" ? 6 : 8, 240);
  return items.length ? { type, items } : undefined;
}

function scene(value: unknown, index: number): Any {
  const item = obj(value);
  const named = text(item.section, 40).toLowerCase();
  const section = (SECTIONS as readonly string[]).includes(named) ? (named as (typeof SECTIONS)[number]) : SECTION_WORDS[named] ?? SECTIONS[Math.min(index, SECTIONS.length - 1)];
  const picture = visual(item.visual);
  const question = interaction(item.interaction);
  return {
    id: text(item.id, 40) || `s${index + 1}`,
    section,
    purpose: text(item.purpose, 300),
    title: text(item.title, 120),
    ...(optional(item.subtitle, 200) ? { subtitle: optional(item.subtitle, 200) } : {}),
    ...(optional(item.takeaway ?? item.soWhat, 240) ? { takeaway: optional(item.takeaway ?? item.soWhat, 240) } : {}),
    onScreen: list(item.onScreen, 6, 200),
    ...(picture ? { visual: picture } : {}),
    narration: text(item.narration, 2400),
    pauseSeconds: number(item.pauseSeconds, 0, 20, 1),
    cue: pick(item.cue, ["greet", "point", "pause", "none"] as const, "none"),
    ...(question ? { interaction: question } : {}),
    accessibility: text(item.accessibility, 400),
    sources: list(item.sources, 6, 20),
  };
}

export function tidyBlueprint(raw: unknown): unknown {
  if (!isObject(raw)) return raw;
  const meta = obj(raw.meta);
  const design = obj(raw.design);
  const path = obj(raw.learningPath);
  return {
    meta: {
      id: text(meta.id, 80) || "skill-shot",
      title: text(meta.title, 160),
      version: text(meta.version, 20) || "0.1.0",
      domain: text(meta.domain, 120),
      ...(optional(meta.industry, 120) ? { industry: optional(meta.industry, 120) } : {}),
      ...(optional(meta.functionName, 160) ? { functionName: optional(meta.functionName, 160) } : {}),
      ...(optional(meta.role, 160) ? { role: optional(meta.role, 160) } : {}),
      targetAudience: text(meta.targetAudience, 300),
      proficiency: pick(meta.proficiency, ["foundational", "working", "advanced"] as const, "working"),
      language: text(meta.language, 60) || "English (India)",
      teachingPattern: pick(text(meta.teachingPattern, 4).toUpperCase().slice(0, 1), ["A", "B", "C", "D", "E", "F"] as const, "A"),
      patternReason: text(meta.patternReason, 600),
      prerequisites: list(meta.prerequisites, 5, 300),
      parentSkill: text(meta.parentSkill, 160),
      relatedSkillShots: list(meta.relatedSkillShots, 6, 80),
      contributorAttribution: text(meta.contributorAttribution, 300),
      reviewStatus: pick(meta.reviewStatus, ["draft", "in_review", "approved", "published"] as const, "draft"),
      skillMap: (Array.isArray(meta.skillMap) ? meta.skillMap : []).slice(0, 6).map((entry) => ({ skill: text(obj(entry).skill, 80), toLevel: number(obj(entry).toLevel, 0.5, 5, 2) })),
    },
    design: {
      learningNeed: text(design.learningNeed, 600),
      learningObjective: text(design.learningObjective, 400),
      successCriteria: list(design.successCriteria, 6, 300),
      caseContext: text(design.caseContext, 800),
      keyConcept: text(design.keyConcept, 900),
      methodOrFramework: text(design.methodOrFramework, 900),
      stepByStepApplication: list(design.stepByStepApplication, 10, 400),
      workedExample: text(design.workedExample, 900),
      commonMistakes: list(design.commonMistakes, 8, 300),
      limitationsAndCaveats: list(design.limitationsAndCaveats, 6, 400),
      learnerChallenge: text(design.learnerChallenge, 600),
      workplaceTransferTask: text(design.workplaceTransferTask, 800),
      summaryTakeaways: list(design.summaryTakeaways, 5, 300),
      nextLearningRecommendation: (Array.isArray(design.nextLearningRecommendation) ? design.nextLearningRecommendation : design.nextLearningRecommendation ? [design.nextLearningRecommendation] : []).slice(0, 5).map((entry) => (isObject(entry) ? { label: text(entry.label ?? entry.title, 160), ...(optional(entry.href, 200) ? { href: optional(entry.href, 200) } : {}), why: text(entry.why ?? entry.reason, 300) } : { label: text(entry, 160), why: "" })).filter((entry) => entry.label),
    },
    disclosure: text(raw.disclosure, 800),
    scenes: (Array.isArray(raw.scenes) ? raw.scenes : []).slice(0, 12).map(scene),
    knowledgeCheck: (Array.isArray(raw.knowledgeCheck) ? raw.knowledgeCheck : []).slice(0, 6).map((entry, index) => {
      const question = obj(entry);
      const choices = options(question.options);
      return { id: text(question.id, 20) || `q${index + 1}`, prompt: text(question.prompt ?? question.question, 400), options: choices, correctId: correct(question.correctId ?? question.correct ?? question.answer, choices), why: text(question.why ?? question.rationale, 500) };
    }).filter((question) => question.options.length >= 2),
    sources: (Array.isArray(raw.sources) ? raw.sources : []).slice(0, 12).map((entry, index) => {
      const source = obj(entry);
      return { id: text(source.id, 20) || `S${index + 1}`, kind: pick(source.kind, ["illustrative", "method", "product", "design", "expert-interview", "document"] as const, "document"), label: text(source.label ?? (typeof entry === "string" ? entry : ""), 240), ...(optional(source.where, 200) ? { where: optional(source.where, 200) } : {}) };
    }),
    learningPath: { skillSet: text(path.skillSet, 160), capabilityModule: text(path.capabilityModule, 160), rolePath: text(path.rolePath, 160), position: text(path.position, 300) },
  };
}
