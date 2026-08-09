export const pillars = [
  {
    id: "digital-fluency",
    name: "Digital Fluency",
    shortName: "Digital",
    question: "When a new digital tool appears at work, what do you usually do?",
    options: [
      "Wait until someone shows me exactly what to do",
      "Try it when I have a clear reason",
      "Explore it and adapt it to my work",
      "Help others use it and improve the workflow",
    ],
  },
  {
    id: "critical-thinking",
    name: "Critical Thinking",
    shortName: "Thinking",
    question: "When a problem has several possible causes, how do you respond?",
    options: [
      "Choose the first explanation that sounds right",
      "Ask someone experienced what they think",
      "Compare evidence before deciding",
      "Test assumptions and explain the trade-offs",
    ],
  },
  {
    id: "creativity",
    name: "Creativity & Innovation",
    shortName: "Creativity",
    question: "How often do you change an existing process to make it work better?",
    options: [
      "Rarely; I prefer proven methods",
      "When the current method clearly fails",
      "Often; I look for practical improvements",
      "Regularly; I design and test new approaches",
    ],
  },
  {
    id: "human-skills",
    name: "Human Skills",
    shortName: "People",
    question: "When you need support from someone you do not manage, what works best?",
    options: [
      "Escalate the request through authority",
      "Explain what I need and follow up",
      "Connect the request to a shared outcome",
      "Understand their priorities and build commitment",
    ],
  },
  {
    id: "adaptive-leadership",
    name: "Adaptive Leadership",
    shortName: "Adaptability",
    question: "When plans change unexpectedly, what is your first move?",
    options: [
      "Wait for clearer instructions",
      "Adjust my own tasks",
      "Re-prioritise and communicate the change",
      "Help the group learn and move forward together",
    ],
  },
] as const;

export type PillarId = (typeof pillars)[number]["id"];
export type AssessmentAnswers = Partial<Record<PillarId, number>>;

export type PillarScore = {
  id: PillarId;
  name: string;
  shortName: string;
  score: number;
  level: "Foundation" | "Developing" | "Practising" | "Leading";
};

export function scoreAssessment(answers: AssessmentAnswers): PillarScore[] {
  return pillars.map((pillar) => {
    const answer = answers[pillar.id];

    if (answer === undefined || answer < 0 || answer > 3) {
      throw new Error(`Missing or invalid answer for ${pillar.id}.`);
    }

    const score = 25 + answer * 25;
    const level = ["Foundation", "Developing", "Practising", "Leading"][answer] as PillarScore["level"];

    return {
      id: pillar.id,
      name: pillar.name,
      shortName: pillar.shortName,
      score,
      level,
    };
  });
}

export function findPriorityPillars(scores: PillarScore[], count = 2): PillarScore[] {
  return [...scores].sort((left, right) => left.score - right.score).slice(0, count);
}