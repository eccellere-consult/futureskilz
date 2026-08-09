import { findPriorityPillars, type PillarId, type PillarScore } from "../assessment/model";

export type SkillShot = {
  slug: string;
  pillarId: PillarId;
  title: string;
  objective: string;
  whyItMatters: string;
  concept: string;
  example: string;
  practicePrompt: string;
  durationMinutes: number;
  checkIn: {
    question: string;
    options: string[];
    correctIndex: number;
  };
};

export const skillShots: SkillShot[] = [
  {
    slug: "ai-decision-brief",
    pillarId: "digital-fluency",
    title: "Use AI to sharpen a decision",
    objective: "Turn a vague decision into a short, evidence-aware brief with AI support.",
    whyItMatters: "AI is most useful when it improves your judgement rather than replacing it.",
    concept: "Give AI a decision, constraints, known evidence, and a request to challenge your assumptions. Treat the response as a second opinion, then verify its claims.",
    example: "Instead of asking ‘Which vendor is best?’, ask for a comparison against your budget, implementation time, data policy, and three risks you may have missed.",
    practicePrompt: "Choose one decision on your desk. Write the four constraints an AI assistant must respect before it can help.",
    durationMinutes: 4,
    checkIn: {
      question: "What is the strongest use of AI in a work decision?",
      options: ["Letting it make the final choice", "Using it to test assumptions and surface gaps", "Copying its first answer into a report"],
      correctIndex: 1,
    },
  },
  {
    slug: "assumption-test",
    pillarId: "critical-thinking",
    title: "Test the assumption underneath",
    objective: "Separate facts, interpretations, and assumptions before acting.",
    whyItMatters: "Teams often solve the wrong problem because a plausible explanation is treated as a fact.",
    concept: "Write what you observed, what you believe it means, and what would prove that belief wrong. The third line turns opinion into a testable assumption.",
    example: "‘Customers dislike the feature’ becomes: usage fell 18%; we think setup is confusing; five observed onboarding sessions would challenge or support that view.",
    practicePrompt: "Take one current problem and write its observation, interpretation, and disconfirming test.",
    durationMinutes: 4,
    checkIn: {
      question: "Which statement makes an assumption useful?",
      options: ["It sounds credible", "A senior person agrees", "It includes evidence that could prove it wrong"],
      correctIndex: 2,
    },
  },
  {
    slug: "three-options",
    pillarId: "creativity",
    title: "Create three workable options",
    objective: "Move beyond the first acceptable idea without losing practical focus.",
    whyItMatters: "A single idea feels like a decision. Three options reveal trade-offs and create room for originality.",
    concept: "Generate a safe option, a bold option, and a low-cost option. Then combine the strongest feature from each into a fourth practical choice.",
    example: "For training uptake: improve reminders, redesign learning around live work, or run peer-led practice. A combined option can use peer sessions around real tasks with lighter reminders.",
    practicePrompt: "Name a current constraint and sketch one safe, one bold, and one low-cost response.",
    durationMinutes: 5,
    checkIn: {
      question: "Why deliberately create three different options?",
      options: ["To delay the decision", "To expose trade-offs and escape the first idea", "To make every stakeholder happy"],
      correctIndex: 1,
    },
  },
  {
    slug: "influence-map",
    pillarId: "human-skills",
    title: "Influence without authority",
    objective: "Frame a request around another person’s priorities and a shared outcome.",
    whyItMatters: "Cross-functional work moves through trust and relevance, not reporting lines.",
    concept: "Map what the other person is measured on, what risk they carry, and what shared result you both need. Make the smallest clear request that advances that result.",
    example: "Instead of ‘I need your data by Friday’, try ‘We both need Monday’s launch decision to be credible. Could we review the three missing fields together for 15 minutes today?’",
    practicePrompt: "Rewrite one pending request using their priority, the shared outcome, and one small next action.",
    durationMinutes: 4,
    checkIn: {
      question: "What makes a cross-functional request more influential?",
      options: ["Repeating it more often", "Connecting it to a shared outcome", "Copying a senior leader"],
      correctIndex: 1,
    },
  },
  {
    slug: "change-reset",
    pillarId: "adaptive-leadership",
    title: "Reset the plan when reality changes",
    objective: "Re-prioritise quickly while preserving clarity and trust.",
    whyItMatters: "People can absorb change when they understand what changed, what remains true, and what happens next.",
    concept: "Use a three-part reset: name the new fact, protect the outcome that still matters, and identify the next reversible action.",
    example: "A supplier delay changes the launch date. The customer outcome stays fixed, so the team tests a limited release while sourcing the remaining component.",
    practicePrompt: "Describe one recent change using: new fact, protected outcome, next reversible action.",
    durationMinutes: 4,
    checkIn: {
      question: "What should stay clear when a plan changes?",
      options: ["Who caused the problem", "The outcome that still matters", "The original task list"],
      correctIndex: 1,
    },
  },
];

export type JourneyStep = {
  sequence: number;
  status: "ready" | "up-next";
  skillShot: SkillShot;
};

export function buildStarterJourney(scores: PillarScore[], completedSlugs: string[] = []): JourneyStep[] {
  const completed = completedSlugs
    .map((slug) => getSkillShot(slug))
    .filter((skillShot): skillShot is SkillShot => Boolean(skillShot))
    .slice(0, 2);
  const remaining = findPriorityPillars(scores, scores.length)
    .map((pillar) => skillShots.find((candidate) => candidate.pillarId === pillar.id))
    .filter((skillShot): skillShot is SkillShot => Boolean(skillShot))
    .filter((skillShot) => !completedSlugs.includes(skillShot.slug))
    .slice(0, 2 - completed.length);

  return [...completed, ...remaining].map((skillShot, index) => {
    if (!skillShot) {
      throw new Error("A journey step is missing its Skill Shot.");
    }

    return {
      sequence: index + 1,
      status: index === 0 ? "ready" : "up-next",
      skillShot,
    };
  });
}

export function getSkillShot(slug: string): SkillShot | undefined {
  return skillShots.find((skillShot) => skillShot.slug === slug);
}

export function applyEvidence(scores: PillarScore[], pillarId: PillarId, points = 10): PillarScore[] {
  return scores.map((pillar) => {
    if (pillar.id !== pillarId) return pillar;

    const score = Math.min(100, pillar.score + points);
    const level = score >= 90 ? "Leading" : score >= 65 ? "Practising" : score >= 40 ? "Developing" : "Foundation";
    return { ...pillar, score, level };
  });
}