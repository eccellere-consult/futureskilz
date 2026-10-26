/**
 * A designed Skill Shot: one capability taught in about 5 to 10 minutes by Arya, built to the FutureSkilz Skill Shot instructional
 * design skill (docs/skill-shots/skill.md). The blueprint is the single source: the player, the seven deliverable documents and the
 * quality checks are all made from it, so they cannot drift apart.
 */

export type TeachingPattern = "A" | "B" | "C" | "D" | "E" | "F";
export type Proficiency = "foundational" | "working" | "advanced";
export type ReviewStatus = "draft" | "in_review" | "approved" | "published";
export type SceneSection = "hook" | "outcome" | "concept" | "method" | "application" | "challenge" | "summary";
export type AvatarCue = "greet" | "point" | "pause" | "none";

export type SourceRef = {
  id: string;
  kind: "illustrative" | "method" | "product" | "design" | "expert-interview" | "document";
  label: string;
  /** Where to look, when the source is a page or a tool in the product. */
  where?: string;
};

/** What appears on screen next to Arya. Concise by design: the narration is not repeated as a paragraph. */
export type Visual =
  | { type: "case-card"; heading: string; facts: string[]; label?: string }
  | { type: "compare"; leftTitle: string; rightTitle: string; rows: Array<[label: string, left: string, right: string]> }
  | { type: "steps"; items: string[] }
  | { type: "why-chain"; problem: string; links: Array<{ why: string; because: string }>; root?: string }
  | { type: "checklist"; title: string; items: string[] }
  | { type: "takeaways"; items: string[] };

export type ChoiceOption = { id: string; text: string; feedback: string };
export type Interaction = { prompt: string; context?: string; options: ChoiceOption[]; correctId: string; thinkSeconds: number; rationale: string };

export type Scene = {
  id: string;
  section: SceneSection;
  purpose: string;
  title: string;
  onScreen: string[];
  visual?: Visual;
  /** What Arya says. Captions are this text. */
  narration: string;
  /** Silent thinking time after the narration, in seconds. */
  pauseSeconds: number;
  cue: AvatarCue;
  interaction?: Interaction;
  accessibility: string;
  /** Source ids for every factual claim in this scene. */
  sources: string[];
};

export type KnowledgeQuestion = { id: string; prompt: string; options: ChoiceOption[]; correctId: string; why: string };

export type Blueprint = {
  meta: {
    id: string;
    title: string;
    version: string;
    domain: string;
    industry?: string;
    functionName?: string;
    role?: string;
    targetAudience: string;
    proficiency: Proficiency;
    language: string;
    teachingPattern: TeachingPattern;
    patternReason: string;
    prerequisites: string[];
    parentSkill: string;
    relatedSkillShots: string[];
    contributorAttribution: string;
    reviewStatus: ReviewStatus;
    /** The capabilities this builds and the level a learner can reach (0 to 5), as the Skill Graph names them. */
    skillMap: Array<{ skill: string; toLevel: number }>;
  };
  design: {
    learningNeed: string;
    learningObjective: string;
    successCriteria: string[];
    caseContext: string;
    keyConcept: string;
    methodOrFramework: string;
    stepByStepApplication: string[];
    workedExample: string;
    commonMistakes: string[];
    limitationsAndCaveats: string[];
    learnerChallenge: string;
    workplaceTransferTask: string;
    summaryTakeaways: string[];
    nextLearningRecommendation: Array<{ label: string; href?: string; why: string }>;
  };
  disclosure: string;
  scenes: Scene[];
  knowledgeCheck: KnowledgeQuestion[];
  sources: SourceRef[];
  learningPath: { skillSet: string; capabilityModule: string; rolePath: string; position: string };
};
