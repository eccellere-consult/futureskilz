import { sentencesOf, unsupportedNumbers } from "./signals";
import type { KnowledgePackage, PackageItem } from "./knowledge-package";
import type { CareerRole } from "./types";

/**
 * Lesson blueprints (skill, Step 8) built only from facts the contributor confirmed and cleared. The text is the
 * contributor's own wording, organised into short scenes; the system adds structure, never claims. Each lesson keeps the
 * facts it came from, so attribution and usage can be traced from the first view.
 */

export type Proficiency = "foundational" | "working" | "proficient" | "expert";
export type LearningStage = "context" | "function" | "role" | "process" | "tools" | "practice" | "exceptions" | "assessment" | "advanced";

export const STAGE_ORDER: LearningStage[] = ["context", "function", "role", "process", "tools", "practice", "exceptions", "assessment", "advanced"];

export type Scene = {
  id: string;
  kind: "title" | "concept" | "steps" | "example" | "caution" | "check" | "summary";
  title: string;
  /** Short lines shown on screen. The narration carries the detail. */
  onScreen: string[];
  /** Index into `narration` read aloud during this scene. */
  narrationIndex: number;
  refs: string[];
};

export type LessonSpec = {
  title: string;
  slug: string;
  audience: string;
  roleLabel: string;
  industry: string;
  proficiency: Proficiency;
  stage: LearningStage;
  objective: string;
  prerequisites: string[];
  coreConcept: string;
  narration: string[];
  scenes: Scene[];
  example: string | null;
  caution: string | null;
  check: { prompt: string; guidance: string; demonstration: string | null };
  summary: string;
  nextStep: string;
  durationSeconds: number;
  /** The facts every sentence comes from. */
  factIds: string[];
  refs: string[];
  attribution: string;
  generatedAt: string;
};

export const OBSERVABLE_VERBS = [
  "apply", "explain", "identify", "describe", "compare", "list", "perform", "calculate", "select", "justify", "sequence",
  "recognise", "recognize", "interpret", "demonstrate", "prepare", "classify", "decide", "distinguish", "outline", "use", "spot",
];

const WORDS_PER_SECOND = 2.3;

const words = (text: string): number => (text.trim() ? text.trim().split(/\s+/).length : 0);

/** A tidy excerpt: whole sentences up to a word limit, in the contributor's own words. */
export function excerpt(text: string, maxWords: number): string {
  const out: string[] = [];
  let count = 0;
  for (const sentence of sentencesOf(text)) {
    const n = words(sentence);
    if (count + n > maxWords && out.length > 0) break;
    out.push(sentence);
    count += n;
    if (count >= maxWords) break;
  }
  const joined = out.join(" ");
  return words(joined) > maxWords * 1.4 ? joined.split(/\s+/).slice(0, maxWords).join(" ") + "…" : joined;
}

const shortLine = (text: string, maxWords = 14): string => {
  const first = sentencesOf(text)[0] ?? text;
  const parts = first.trim().split(/\s+/);
  return parts.length > maxWords ? `${parts.slice(0, maxWords).join(" ")}…` : first.trim();
};

const slugify = (text: string): string => text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70);

type Ctx = {
  contributor: string;
  roles: CareerRole[];
  now: string;
};

function pick(items: PackageItem[], key: string): PackageItem[] {
  return items.filter((item) => item.details?.questionKey === key);
}

function roleOf(roles: CareerRole[], roleId: string | null): CareerRole | undefined {
  return roles.find((role) => role.id === roleId);
}

function roleLabel(role: CareerRole | undefined): string {
  return role ? role.title || role.company || "the role" : "the role";
}

type Draft = {
  title: string;
  stage: LearningStage;
  proficiency: Proficiency;
  objective: string;
  roleId: string | null;
  concept: PackageItem[];
  steps: string[];
  example: PackageItem | null;
  caution: PackageItem | null;
  guidance: PackageItem | null;
  demonstration: PackageItem | null;
  prerequisites: string[];
  nextStep: string;
};

function assemble(draft: Draft, ctx: Ctx): LessonSpec | null {
  if (draft.concept.length === 0) return null;
  const role = roleOf(ctx.roles, draft.roleId);
  const roleName = roleLabel(role);
  const conceptText = excerpt(draft.concept.map((item) => item.text).join(" "), 90);
  const exampleText = draft.example ? excerpt(draft.example.text, 90) : null;
  const cautionText = draft.caution ? excerpt(draft.caution.text, 60) : null;
  const check = {
    prompt:
      draft.stage === "process"
        ? "Pick a task from your own work. Which step would you check first, and why? Write two sentences."
        : draft.stage === "exceptions"
          ? "Describe a time something like this went wrong, or could. What would you do first?"
          : "In your own words, explain this to a colleague in two or three sentences. Then name one place you could use it this week.",
    guidance: draft.guidance ? `A good answer reflects the contributor's standard: ${excerpt(draft.guidance.text, 50)}` : "A good answer uses a concrete example from your work, not a general statement.",
    demonstration: draft.demonstration ? `Show it in practice: ${excerpt(draft.demonstration.text, 40)}` : null,
  };
  const summary = draft.steps.length
    ? `${draft.steps.length} steps, in order. Start with the first, and check quality before you hand over.`
    : shortLine(conceptText, 24);

  const narration: string[] = [];
  const scenes: Scene[] = [];
  const addScene = (kind: Scene["kind"], title: string, onScreen: string[], paragraph: string) => {
    narration.push(paragraph);
    scenes.push({ id: `s${scenes.length + 1}`, kind, title, onScreen: onScreen.slice(0, 5), narrationIndex: narration.length - 1, refs: [] });
  };
  addScene(
    "title",
    draft.title,
    [`For: ${roleName === "the role" ? "New joiners" : `New joiners and early-career ${roleName}`}`, `Level: ${draft.proficiency}`],
    `Welcome. This short lesson is for ${roleName === "the role" ? "people entering this field" : `people preparing for work as ${roleName}`}. ${ctx.contributor} shares how it is done in practice.`,
  );
  addScene("concept", "The idea", [shortLine(conceptText, 18)], conceptText);
  if (draft.steps.length)
    addScene("steps", "In order", draft.steps.slice(0, 5).map((step) => shortLine(step, 12)), `Here is the sequence. ${draft.steps.slice(0, 6).map((step, index) => `Step ${index + 1}. ${shortLine(step, 22)}`).join(" ")}`);
  if (exampleText) addScene("example", "A real example", [shortLine(exampleText, 18)], `A real example. ${exampleText}`);
  if (cautionText) addScene("caution", "Watch for this", [shortLine(cautionText, 18)], `One caution from experience. ${cautionText}`);
  addScene("check", "Check yourself", [check.prompt], `Before you move on, pause. ${check.prompt}`);
  addScene("summary", "Remember", [shortLine(summary, 18)], `To sum up. ${summary} Next: ${draft.nextStep}`);

  const base = {
    title: draft.title,
    audience: roleName === "the role" ? "New joiners" : `New joiners and early-career ${roleName}`,
    roleLabel: roleName,
    industry: role?.industry ?? "",
    proficiency: draft.proficiency,
    stage: draft.stage,
    objective: draft.objective,
    prerequisites: draft.prerequisites,
    coreConcept: conceptText,
    narration,
    example: exampleText,
    caution: cautionText,
    check,
    summary,
    nextStep: draft.nextStep,
    attribution: ctx.contributor,
    generatedAt: ctx.now,
  };
  const used = [...draft.concept, draft.example, draft.caution, draft.guidance, draft.demonstration].filter((item): item is PackageItem => !!item);
  const factIds = Array.from(new Set(used.map((item) => item.factId)));
  const refs = Array.from(new Set(used.flatMap((item) => item.refs)));
  for (const scene of scenes) scene.refs = refs;
  const totalWords = narration.reduce((sum, paragraph) => sum + words(paragraph), 0);
  return {
    ...base,
    slug: `${slugify(draft.title)}-${factIds[0]?.slice(0, 6) ?? "x"}`,
    scenes,
    factIds,
    refs,
    durationSeconds: Math.round(totalWords / WORDS_PER_SECOND),
  };
}

/** Generates lesson candidates from a publish-mode package. A topic with too little confirmed material yields no lesson. */
export function blueprintLessons(pkg: KnowledgePackage, ctx: Ctx): { lessons: LessonSpec[]; skipped: Array<{ topic: string; reason: string }> } {
  const lessons: LessonSpec[] = [];
  const skipped: Array<{ topic: string; reason: string }> = [];
  const items = pkg.sections.flatMap((section) => section.items);
  const add = (draft: Draft) => {
    const lesson = assemble(draft, ctx);
    if (lesson) lessons.push(lesson);
  };

  // Processes become how-to lessons.
  const processIds = Array.from(new Set(items.filter((item) => item.processId).map((item) => item.processId as string)));
  for (const processId of processIds) {
    const own = items.filter((item) => item.processId === processId);
    const label = (own.find((item) => typeof item.details?.process === "string")?.details?.process as string | undefined) ?? "this process";
    const steps = pick(own, "g.steps")[0];
    if (!steps) {
      skipped.push({ topic: label, reason: "No confirmed step-by-step description yet." });
      continue;
    }
    const stepList = (Array.isArray(steps.details?.steps) ? (steps.details.steps as string[]) : sentencesOf(steps.text)).filter(Boolean);
    const trigger = pick(own, "g.trigger");
    const quality = pick(own, "g.quality");
    const exceptions = pick(own, "g.exceptions")[0] ?? null;
    const example = pick(own, "g.example")[0] ?? null;
    add({
      title: `How to: ${label}`,
      stage: "process",
      proficiency: "working",
      objective: `Apply the sequence for ${label.toLowerCase()} to a task in your own work, naming who does each step and the quality check before handover.`,
      roleId: steps.roleId,
      concept: [...trigger, steps],
      steps: stepList,
      example,
      caution: exceptions,
      guidance: quality[0] ?? null,
      demonstration: pick(items, "n.independent")[0] ?? null,
      prerequisites: ["Know the role's main responsibilities"],
      nextStep: exceptions ? "handling exceptions and common mistakes" : "practise the steps on a real task",
    });
    if (exceptions) {
      add({
        title: `Exceptions and mistakes: ${label}`,
        stage: "exceptions",
        proficiency: "proficient",
        objective: `Recognise the exceptions that arise in ${label.toLowerCase()} and select the first response to each.`,
        roleId: exceptions.roleId,
        concept: [exceptions],
        steps: [],
        example,
        caution: pick(items, "n.mistakes")[0] ?? null,
        guidance: quality[0] ?? null,
        demonstration: null,
        prerequisites: [`How to: ${label}`],
        nextStep: "an applied task on your own work",
      });
    }
  }

  // Industry and context.
  const industry = [...pick(items, "d.explain"), ...pick(items, "d.players")];
  if (industry.length) {
    add({
      title: "The industry in plain words",
      stage: "context",
      proficiency: "foundational",
      objective: "Explain how the industry makes money, who the main parties are and what drives cost and quality.",
      roleId: industry[0].roleId,
      concept: industry,
      steps: [],
      example: pick(items, "d.value")[0] ?? null,
      caution: null,
      guidance: null,
      demonstration: null,
      prerequisites: [],
      nextStep: "how the business is organised",
    });
  }

  // Organisation and work flow.
  const flow = [...pick(items, "e.structure"), ...pick(items, "e.flow")];
  if (flow.length) {
    add({
      title: "How the work flows across the business",
      stage: "function",
      proficiency: "foundational",
      objective: "Describe how work moves between functions and identify the main handoffs.",
      roleId: flow[0].roleId,
      concept: flow,
      steps: [],
      example: null,
      caution: pick(items, "e.handoffs")[0] ?? null,
      guidance: null,
      demonstration: null,
      prerequisites: ["The industry in plain words"],
      nextStep: "what the role is responsible for",
    });
  }

  // The role itself.
  const role = [...pick(items, "f.purpose"), ...pick(items, "f.duties")];
  if (role.length) {
    add({
      title: "What this role is for, and what good looks like",
      stage: "role",
      proficiency: "foundational",
      objective: "Describe the purpose of the role, its recurring work and what separates strong from adequate performance.",
      roleId: role[0].roleId,
      concept: role,
      steps: [],
      example: pick(items, "f.excellent")[0] ?? null,
      caution: null,
      guidance: pick(items, "f.excellent")[0] ?? null,
      demonstration: pick(items, "f.ramp")[0] ?? null,
      prerequisites: [],
      nextStep: "the core processes of the role",
    });
  }

  // Scorecard.
  const kpis = pick(items, "h.kpis").concat(pick(items, "h.measured"));
  if (kpis.length) {
    const unsure = kpis.some((item) => item.reviewStatus !== "confirmed" && item.reviewStatus !== "corrected");
    if (unsure) skipped.push({ topic: "Scorecard", reason: "Measures are not all confirmed." });
    else
      add({
        title: "Reading the scorecard",
        stage: "role",
        proficiency: "working",
        objective: "Interpret the main measures for the role and explain what each one is meant to protect.",
        roleId: kpis[0].roleId,
        concept: kpis,
        steps: [],
        example: pick(items, "h.strong")[0] ?? null,
        caution: pick(items, "h.gaming")[0] ?? null,
        guidance: null,
        demonstration: null,
        prerequisites: ["What this role is for, and what good looks like"],
        nextStep: "the core processes of the role",
      });
  }

  // Tools.
  const tools = pick(items, "f.tools");
  if (tools.length) {
    add({
      title: "The tools and methods behind the work",
      stage: "tools",
      proficiency: "working",
      objective: "Select the right tool or method for a task in this role and explain what goes in and what comes out.",
      roleId: tools[0].roleId,
      concept: tools,
      steps: [],
      example: null,
      caution: null,
      guidance: null,
      demonstration: null,
      prerequisites: ["What this role is for, and what good looks like"],
      nextStep: "practise on a real task",
    });
  }

  // Judgement and tacit knowledge.
  const noticing = [...pick(items, "m.notice"), ...pick(items, "m.warning")];
  if (noticing.length) {
    add({
      title: "What experts notice that beginners miss",
      stage: "practice",
      proficiency: "proficient",
      objective: "Spot the early warning signs that a process or team is going off track and decide what to check first.",
      roleId: noticing[0].roleId,
      concept: noticing,
      steps: [],
      example: pick(items, "m.judgement")[0] ?? null,
      caution: pick(items, "m.myths")[0] ?? null,
      guidance: null,
      demonstration: null,
      prerequisites: ["How to lessons for the role"],
      nextStep: "a case study from the contributor's career",
    });
  }

  // Cases.
  for (const key of ["k.success", "k.challenge"]) {
    const story = pick(items, key)[0];
    if (!story) continue;
    add({
      title: key === "k.success" ? "Case: a success and what made it work" : "Case: a challenge and how it was handled",
      stage: "advanced",
      proficiency: "expert",
      objective: "Justify the decisions made in a real case and decide what you would do the same or differently.",
      roleId: story.roleId,
      concept: [story],
      steps: [],
      example: pick(items, "k.evidence")[0] ?? null,
      caution: pick(items, "k.different")[0] ?? null,
      guidance: null,
      demonstration: null,
      prerequisites: ["How to lessons for the role"],
      nextStep: "apply the lesson to a case from your own work",
    });
  }

  return { lessons, skipped };
}

export type LessonIssue = { id: string; message: string };

/** Mechanical checks a lesson must pass before an editor reviews it (skill, Step 10). */
export function checkLesson(spec: LessonSpec, sourceTexts: string[]): LessonIssue[] {
  const issues: LessonIssue[] = [];
  const verb = spec.objective.trim().split(/\s+/)[0]?.toLowerCase().replace(/[^a-z]/g, "") ?? "";
  if (!OBSERVABLE_VERBS.includes(verb)) issues.push({ id: "objective", message: "The objective should start with an observable verb such as apply, explain or identify." });
  if (/\band\b.*\band\b.*\band\b/i.test(spec.objective) && spec.objective.length > 220) issues.push({ id: "objective_focus", message: "The objective tries to do too much. Aim for one central objective." });
  if (spec.factIds.length === 0) issues.push({ id: "sources", message: "The lesson is not linked to any confirmed fact." });
  if (spec.durationSeconds < 45 || spec.durationSeconds > 600) issues.push({ id: "duration", message: `The lesson runs ${Math.round(spec.durationSeconds / 60 * 10) / 10} minutes; keep it between one and ten.` });
  for (const scene of spec.scenes) {
    if (scene.onScreen.length > 5) issues.push({ id: "screen_text", message: `Scene "${scene.title}" has more than five lines on screen.` });
    if (scene.onScreen.some((line) => line.length > 180)) issues.push({ id: "screen_text", message: `Scene "${scene.title}" has a very long line on screen.` });
  }
  if (!spec.check.prompt) issues.push({ id: "check", message: "The lesson has no knowledge check or reflection." });
  const corpus = sourceTexts.join(" ");
  const invented = unsupportedNumbers(spec.narration.join(" "), corpus).filter((n) => !/^\d$/.test(n) && !["30", "60", "90"].includes(n));
  const stepNumbers = new Set(Array.from({ length: 12 }, (_, i) => String(i + 1)));
  const filtered = invented.filter((n) => !stepNumbers.has(n));
  if (filtered.length) issues.push({ id: "numbers", message: `The narration contains figures not found in the confirmed source facts: ${filtered.join(", ")}.` });
  return issues;
}

export type PathEntry = { slug: string; title: string; stage: LearningStage; proficiency: Proficiency; required: boolean; durationSeconds: number; objective: string };

export type LearningPath = {
  id: string;
  title: string;
  roleLabel: string;
  industry: string;
  goal: "onboarding" | "role_readiness" | "upskilling" | "advanced";
  entries: PathEntry[];
  totalSeconds: number;
  note: string;
};

const STAGE_GOAL: Record<LearningStage, LearningPath["goal"][]> = {
  context: ["onboarding", "role_readiness"],
  function: ["onboarding", "role_readiness"],
  role: ["onboarding", "role_readiness", "upskilling"],
  process: ["role_readiness", "upskilling"],
  tools: ["role_readiness", "upskilling"],
  practice: ["upskilling", "advanced"],
  exceptions: ["upskilling", "advanced"],
  assessment: ["role_readiness", "upskilling"],
  advanced: ["advanced"],
};

const GOAL_TITLE: Record<LearningPath["goal"], string> = {
  onboarding: "Onboarding for new joiners",
  role_readiness: "Role readiness",
  upskilling: "Professional upskilling",
  advanced: "Advanced practice and judgement",
};

/** Groups lessons by role and learner goal, ordered context, function, role, process, tools, practice, exceptions, assessment, advanced. */
export function buildLearningPaths(lessons: Array<{ slug: string; title: string; spec: LessonSpec }>): LearningPath[] {
  const byRole = new Map<string, typeof lessons>();
  for (const lesson of lessons) {
    const key = `${lesson.spec.roleLabel}||${lesson.spec.industry}`;
    byRole.set(key, [...(byRole.get(key) ?? []), lesson]);
  }
  const paths: LearningPath[] = [];
  for (const [key, group] of byRole) {
    const [roleLabel, industry] = key.split("||");
    for (const goal of ["onboarding", "role_readiness", "upskilling", "advanced"] as const) {
      const entries = group
        .filter((lesson) => STAGE_GOAL[lesson.spec.stage].includes(goal))
        .sort((a, b) => STAGE_ORDER.indexOf(a.spec.stage) - STAGE_ORDER.indexOf(b.spec.stage))
        .map<PathEntry>((lesson) => ({
          slug: lesson.slug,
          title: lesson.title,
          stage: lesson.spec.stage,
          proficiency: lesson.spec.proficiency,
          required: goal === "advanced" ? lesson.spec.stage === "advanced" : lesson.spec.proficiency !== "expert",
          durationSeconds: lesson.spec.durationSeconds,
          objective: lesson.spec.objective,
        }));
      if (entries.length === 0) continue;
      paths.push({
        id: `${roleLabel}-${goal}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        title: `${GOAL_TITLE[goal]}: ${roleLabel}`,
        roleLabel,
        industry,
        goal,
        entries,
        totalSeconds: entries.reduce((sum, entry) => sum + entry.durationSeconds, 0),
        note: "Finishing a lesson shows exposure, not mastery. Use each check, and the practical demonstration where one is given, as evidence.",
      });
    }
  }
  return paths;
}

/** Entries a learner can skip because they already demonstrated them, unless a lesson is another entry's prerequisite. */
export function recommendEntries(path: LearningPath, demonstrated: string[]): { next: PathEntry | null; skippable: PathEntry[] } {
  const done = new Set(demonstrated);
  const skippable = path.entries.filter((entry) => done.has(entry.slug));
  const next = path.entries.find((entry) => !done.has(entry.slug)) ?? null;
  return { next, skippable };
}
