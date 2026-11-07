import type { LessonSpec } from "@/features/capture/lessons";

/**
 * Sample content for the public previews. Nothing here is a real person or a real result: it only shows what each screen looks
 * like after registering. The lesson is a short worked example in the exact format the platform generates.
 */
export const SAMPLE_LESSON: LessonSpec = {
  title: "How to: Weekly production planning and schedule freeze",
  slug: "sample-weekly-planning",
  audience: "New joiners and early-career Production Planning Manager",
  roleLabel: "Production Planning Manager",
  industry: "Manufacturing",
  proficiency: "working",
  stage: "process",
  objective: "Apply the weekly planning sequence to a task in your own work, naming who does each step and the quality check before handover.",
  prerequisites: ["Know the role's main responsibilities"],
  coreConcept: "The process starts every Monday when sales shares the updated forecast. Planners check capacity, then material, then build and sequence the plan, which the Plant Head approves and freezes on Thursday.",
  narration: [
    "Welcome. This short lesson is for people preparing for work as a production planner. A coach shares how it is done in practice.",
    "The process starts every Monday when sales shares the updated customer forecast. Inputs are the forecast, stock levels, machine availability and open orders.",
    "Here is the sequence. Step 1. Review demand against the last four weeks. Step 2. Check capacity line by line. Step 3. Check material with stores. Step 4. Build the plan and sequence jobs to minimise changeovers. Step 5. The Plant Head approves. Step 6. Freeze on Thursday and issue to production.",
    "One caution from experience. Changing a frozen plan without telling stores leaves the line waiting for material.",
    "Before you move on, pause. Pick a task from your own work. Which step would you check first, and why? Write two sentences.",
    "To sum up. Six steps, in order. Start with demand, and check material before you hand over.",
  ],
  scenes: [
    { id: "s1", kind: "title", title: "How to: Weekly production planning", onScreen: ["For: early-career planners", "Level: working"], narrationIndex: 0, refs: [] },
    { id: "s2", kind: "concept", title: "The idea", onScreen: ["Plan every week the same way: demand, capacity, material, then sequence."], narrationIndex: 1, refs: [] },
    { id: "s3", kind: "steps", title: "In order", onScreen: ["Review demand", "Check capacity", "Check material", "Sequence the jobs", "Approve, then freeze"], narrationIndex: 2, refs: [] },
    { id: "s4", kind: "caution", title: "Watch for this", onScreen: ["Never change a frozen plan without telling stores."], narrationIndex: 3, refs: [] },
    { id: "s5", kind: "check", title: "Check yourself", onScreen: ["Pick a task from your own work. Which step would you check first, and why?"], narrationIndex: 4, refs: [] },
    { id: "s6", kind: "summary", title: "Remember", onScreen: ["Six steps, in order. Check material before handover."], narrationIndex: 5, refs: [] },
  ],
  example: null,
  caution: "Changing a frozen plan without telling stores leaves the line waiting for material.",
  check: { prompt: "Pick a task from your own work. Which step would you check first, and why? Write two sentences.", guidance: "A good answer uses a concrete example from your work, not a general statement.", demonstration: null },
  summary: "Six steps, in order. Start with demand, and check material before you hand over.",
  nextStep: "handling exceptions and common mistakes",
  durationSeconds: 95,
  factIds: [],
  refs: ["S12", "S14"],
  attribution: "the coach",
  generatedAt: "2026-01-01T00:00:00.000Z",
};

export const PILLARS = [
  { name: "Digital fluency", score: 58, note: "Self-rated, one Skill Shot done" },
  { name: "Critical thinking", score: 34, note: "Biggest gap for your goal" },
  { name: "Creativity", score: 61, note: "Self-rated" },
  { name: "Human skills", score: 82, note: "Strength to build on" },
  { name: "Adaptive leadership", score: 40, note: "Next after critical thinking" },
];

export const JOURNEY = [
  { title: "Test the assumption underneath", why: "Closes your biggest gap: critical thinking", minutes: 4, status: "Completed" },
  { title: "Use AI to sharpen a decision", why: "Moves digital fluency toward your target level", minutes: 4, status: "Next" },
  { title: "How to: Weekly production planning", why: "A coach's lesson on the task you do every week", minutes: 2, status: "Later" },
];
