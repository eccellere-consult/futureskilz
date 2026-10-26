import type { SkillFamilyId } from "../../domain/skills/taxonomy";

/**
 * The conversational diagnostic's question bank. Every question asks about a RECENT SITUATION and offers observable behaviours,
 * never a self-rating, so a learner picks what they actually did. Options map to levels on the 0 to 5 scale. Self-report stops at
 * level 4: expert-level claims need evidence beyond what a person says about themselves.
 *
 * The six families partition the capability system without overlap (domain knowledge comes from the learner's role and target
 * role, not from a question). Each family has two questions that probe different skills in it, so the second is asked only when
 * it can change the diagnosis.
 */
export type DiagnosticOption = { text: string; level: number };
export type DiagnosticQuestion = {
  id: string;
  /** A short name for the situation, used when the conversation reflects the answer back. */
  topic: string;
  family: SkillFamilyId;
  /** The skills this question gives evidence about, with how directly (0 to 1). */
  skills: Array<{ skill: string; weight: number }>;
  prompt: string;
  /** Why this is asked, shown to the learner. */
  why: string;
  options: DiagnosticOption[];
};

/** Offered on every question. It is never scored: no recent situation means no evidence, not a low level. */
export const NO_SITUATION = "I have not been in this situation recently";

const four = (a: string, b: string, c: string, d: string): DiagnosticOption[] => [
  { text: a, level: 1 },
  { text: b, level: 2 },
  { text: c, level: 3 },
  { text: d, level: 4 },
];

export const QUESTIONS: DiagnosticQuestion[] = [
  {
    id: "think-recurring-problem",
    topic: "A problem that came back",
    family: "human-intelligence",
    skills: [{ skill: "problem-solving", weight: 1 }, { skill: "analytical-thinking", weight: 0.7 }, { skill: "critical-thinking", weight: 0.5 }],
    prompt: "Think of the last problem at work that came back after you thought it was fixed. What did you do?",
    why: "How you handle a repeating problem shows how you find causes, which sits behind most good decisions.",
    options: four(
      "I repeated the same fix, or asked someone else to deal with it.",
      "I looked at what had changed and tried a different fix.",
      "I traced it step by step to a cause, checked that cause with facts, then fixed it.",
      "I fixed the cause and changed the process or checks so it would not return. Others now use that.",
    ),
  },
  {
    id: "think-incomplete-decision",
    topic: "A decision without all the facts",
    family: "human-intelligence",
    skills: [{ skill: "decision-making", weight: 1 }, { skill: "judgment", weight: 0.8 }, { skill: "strategic-thinking", weight: 0.4 }],
    prompt: "Think of the last decision at work where you had to choose without all the facts. How did you decide?",
    why: "Real decisions are rarely complete. This shows how you weigh options when you cannot be certain.",
    options: four(
      "I waited to be told, or went with the first option.",
      "I asked a few people and went with the most common view.",
      "I wrote down the options and what mattered, checked the key facts, then chose.",
      "I also said what would make me change my mind, and reviewed the result afterwards to learn from it.",
    ),
  },
  {
    id: "people-outside-authority",
    topic: "Getting help from someone outside your team",
    family: "human-to-human-intelligence",
    skills: [{ skill: "influence", weight: 1 }, { skill: "stakeholder-management", weight: 0.8 }, { skill: "collaboration", weight: 0.6 }, { skill: "communication", weight: 0.5 }],
    prompt: "Think of the last time you needed help from someone who did not report to you. What did you do?",
    why: "Most work depends on people you cannot instruct. This shows how you win support.",
    options: four(
      "I escalated it, or waited and hoped.",
      "I asked clearly and followed up.",
      "I linked the request to what they care about and agreed one small next step.",
      "I built a working agreement with them, so requests like this now go smoothly.",
    ),
  },
  {
    id: "people-hard-conversation",
    topic: "A difficult conversation",
    family: "human-to-human-intelligence",
    skills: [{ skill: "conflict-management", weight: 1 }, { skill: "active-listening", weight: 0.8 }, { skill: "empathy", weight: 0.7 }, { skill: "coaching", weight: 0.3 }],
    prompt: "Think of the last disagreement or difficult conversation at work. How did you handle it?",
    why: "Hard conversations test listening and fairness under pressure.",
    options: four(
      "I avoided it, or let it pass.",
      "I said my view and hoped it would settle.",
      "I listened first, checked I had understood, then we agreed what would happen next.",
      "I helped the others reach an agreement, and the working relationship was stronger afterwards.",
    ),
  },
  {
    id: "self-sudden-change",
    topic: "A sudden change of plans",
    family: "self-intelligence",
    skills: [{ skill: "adaptability", weight: 1 }, { skill: "resilience", weight: 0.7 }, { skill: "leadership", weight: 0.3 }],
    prompt: "Think of the last time plans or priorities changed suddenly. What was your first move?",
    why: "Change is constant. Your first move shows how steady you stay and who else you bring along.",
    options: four(
      "I waited for clearer instructions.",
      "I adjusted my own tasks.",
      "I re-prioritised, and told the people affected what changed and what stayed the same.",
      "I helped the group adapt, and afterwards we looked at what to do earlier next time.",
    ),
  },
  {
    id: "self-hard-feedback",
    topic: "Feedback that was hard to hear",
    family: "self-intelligence",
    skills: [{ skill: "self-awareness", weight: 1 }, { skill: "growth-mindset", weight: 0.8 }, { skill: "personal-effectiveness", weight: 0.5 }, { skill: "emotional-regulation", weight: 0.4 }],
    prompt: "Think of the last piece of feedback that was hard to hear. What did you do with it?",
    why: "How you use difficult feedback shows how quickly you can grow.",
    options: four(
      "I defended myself, or put it aside.",
      "I thought about it but did not change anything.",
      "I asked for an example, picked one thing to change, and tried it.",
      "I made the change, checked with the person that it worked, and shared what I learned.",
    ),
  },
  {
    id: "ai-recent-use",
    topic: "Using AI for work",
    family: "ai-intelligence",
    skills: [{ skill: "ai-literacy", weight: 1 }, { skill: "generative-ai", weight: 0.8 }, { skill: "prompting", weight: 0.7 }, { skill: "ai-collaboration", weight: 0.6 }],
    prompt: "Think of the last time you used an AI tool for work, or chose not to. What did you do?",
    why: "AI is changing most roles. This shows where you are starting from, with no judgement.",
    options: [
      { text: "I have not used an AI tool for work yet.", level: 0.5 },
      { text: "I tried it for simple things, such as rewording text.", level: 1.5 },
      { text: "I use it regularly. I give it background and read the answer critically.", level: 2.5 },
      { text: "I use it for analysis or decisions, check the facts it gives, and know what not to share with it.", level: 3.5 },
      { text: "I set up how my team uses it, with checks and rules, and I help others learn it.", level: 4 },
    ],
  },
  {
    id: "ai-answer-that-mattered",
    topic: "Relying on an AI answer",
    family: "ai-intelligence",
    skills: [{ skill: "ai-assisted-decision-making", weight: 1 }, { skill: "ai-ethics", weight: 0.7 }, { skill: "ai-governance", weight: 0.5 }, { skill: "critical-thinking", weight: 0.4 }],
    prompt: "Think of the last time an AI answer mattered for something you did. What did you do before relying on it?",
    why: "The value of AI depends on the checking around it.",
    options: four(
      "I used it as it was.",
      "I read it and fixed the obvious mistakes.",
      "I checked the key facts against another source and noted where AI had helped.",
      "I set a check my team follows: sources, review, and what data may be used.",
    ),
  },
  {
    id: "digital-numbers-question",
    topic: "Using numbers to answer a question",
    family: "digital-intelligence",
    skills: [{ skill: "data-literacy", weight: 1 }, { skill: "analytical-thinking", weight: 0.3 }],
    prompt: "Think of the last time you used numbers or a report to answer a work question. What did you do?",
    why: "Numbers can mislead. This shows how you test them before you act.",
    options: four(
      "I took the report as it was.",
      "I checked the totals and looked at one or two figures.",
      "I compared across periods or groups, looked for what could mislead, and gave the answer with its limits.",
      "I built or fixed a report or measure that others now rely on.",
    ),
  },
  {
    id: "digital-tool-misfit",
    topic: "A tool that did not fit",
    family: "digital-intelligence",
    skills: [{ skill: "digital-literacy", weight: 1 }, { skill: "automation", weight: 0.8 }, { skill: "technology-literacy", weight: 0.7 }, { skill: "cybersecurity-awareness", weight: 0.3 }],
    prompt: "Think of the last time a digital tool at work did not fit how you work. What did you do?",
    why: "Comfort with tools decides how much time you spend on repeat work.",
    options: four(
      "I worked around it, or asked someone for help.",
      "I learned its settings and features.",
      "I changed the setup, or automated a step I repeat.",
      "I redesigned the workflow with my team and trained others on it.",
    ),
  },
  {
    id: "func-deadline-team-work",
    topic: "Work with a deadline and several people",
    family: "functional-intelligence",
    skills: [{ skill: "project-management", weight: 1 }, { skill: "operations", weight: 0.8 }, { skill: "stakeholder-management", weight: 0.3 }],
    prompt: "Think of the last piece of work with a deadline and several people involved. How did you run it?",
    why: "Turning intent into delivered work is the core of business execution.",
    options: four(
      "I did my part and waited for the rest.",
      "I kept a task list.",
      "I set the goal, owners, dates and risks on one page and checked progress regularly.",
      "I also adjusted the plan when risks appeared, and reported results to the people who sponsored it.",
    ),
  },
  {
    id: "func-worth-the-cost",
    topic: "Explaining why work was worth its cost",
    family: "functional-intelligence",
    skills: [{ skill: "finance", weight: 1 }, { skill: "strategy", weight: 0.7 }, { skill: "product-management", weight: 0.5 }, { skill: "marketing", weight: 0.3 }],
    prompt: "Think of the last time you had to explain why a piece of work was worth its cost or time. What did you do?",
    why: "Linking work to results is how ideas get approved and funded.",
    options: four(
      "I said it was needed.",
      "I listed the benefits.",
      "I compared the cost with a measurable result, and with an alternative.",
      "I built the business case that others used to decide, and tracked the result afterwards.",
    ),
  },
];

export const questionById = (id: string): DiagnosticQuestion | undefined => QUESTIONS.find((question) => question.id === id);

/** Asked after a strong claim, because what happened as a result is firmer evidence than what a person says they did. */
export type OutcomeOption = { text: string; confidence: number };
export const OUTCOME_OPTIONS: OutcomeOption[] = [
  { text: "I am not sure what came of it.", confidence: 0.3 },
  { text: "It worked, but I cannot point to a specific result.", confidence: 0.45 },
  { text: "I can point to a specific result: a figure, a decision, or what someone said.", confidence: 0.6 },
  { text: "It did not work as planned, and I learned something from it.", confidence: 0.5 },
];

export const REPORTED_BEHAVIOUR_CONFIDENCE = 0.4;
/** What a person says about themselves is never treated as better than this, however many answers agree. */
export const SELF_REPORT_CONFIDENCE_CAP = 0.7;
