import { z } from "zod";

import { skillTaxonomy } from "../../domain/skills/taxonomy";

/** The skill slugs a topic may map to: the same list the Skill Shot brief checks. */
export const knownSkills: ReadonlySet<string> = new Set(skillTaxonomy.map((skill) => skill.slug));

export const MAX_DEPTH = 3;
/** A leaf is meant to become one Skill Shot of 5 to 10 minutes. */
export const LEAF_MIN_MINUTES = 3;
export const LEAF_MAX_MINUTES = 12;

export const proficiencies = ["foundational", "working", "advanced"] as const;
export type Proficiency = (typeof proficiencies)[number];

/** What the coach tells us about the training. All of it is the person's statement, not a measurement. */
export const programBriefSchema = z.object({
  topic: z.string().trim().min(4, "Say what the training is about.").max(300),
  audience: z.object({
    role: z.string().trim().min(2, "Say who the learners are.").max(160),
    level: z.enum(proficiencies),
    language: z.string().trim().max(40).default("English"),
    groupSize: z.string().trim().max(60).optional(),
  }),
  goal: z.string().trim().min(4, "Say what should be different after the training.").max(600),
  constraints: z
    .object({
      minutesPerLearner: z.number().int().min(10).max(6000).optional(),
      deadline: z.string().trim().max(80).optional(),
      notes: z.string().trim().max(600).optional(),
    })
    .default({}),
  /** Anything the client said: complaints, numbers, observations. Used as evidence, never as instructions. */
  context: z.string().trim().max(4000).default(""),
});
export type ProgramBrief = z.infer<typeof programBriefSchema>;

export const evidenceLabels = ["stated", "inferred", "assumption"] as const;
export const priorities = ["high", "medium", "low"] as const;

/** A learner need as the model proposes it. Ids are given by the code, never by the model. */
export const needDraftSchema = z.object({
  statement: z.string().trim().min(8).max(300),
  evidence: z.enum(evidenceLabels),
  priority: z.enum(priorities),
  askClient: z.string().trim().max(300).nullish(),
});
export const needsDraftSchema = z.object({ needs: z.array(needDraftSchema).min(3).max(12) });
export type NeedsDraft = z.infer<typeof needsDraftSchema>;

export const needSchema = needDraftSchema.extend({
  id: z.string().min(1).max(40),
  askClient: z.string().trim().max(300).nullable(),
  status: z.enum(["proposed", "confirmed", "rejected"]),
});
export type Need = z.infer<typeof needSchema>;

export type TopicStatus = "proposed" | "approved" | "rejected";

/** One row of the topic tree. */
export type TopicNode = {
  id: string;
  parentId: string | null;
  position: number;
  title: string;
  summary: string;
  targetLevel: number | null;
  skills: string[];
  needIds: string[];
  prerequisites: string[];
  materialHint: string;
  evidenceSignal: string;
  minutes: number | null;
  status: TopicStatus;
  origin: "ai" | "person";
};

export type DraftNode = {
  title: string;
  summary?: string;
  targetLevel?: number | null;
  skills?: string[];
  needIds?: string[];
  materialHint?: string;
  evidenceSignal?: string;
  minutes?: number | null;
  children?: DraftNode[];
};

export const draftNodeSchema: z.ZodType<DraftNode> = z.lazy(() =>
  z.object({
    title: z.string().trim().min(3).max(200),
    summary: z.string().trim().max(600).optional(),
    targetLevel: z.number().min(0.5).max(5).nullish(),
    skills: z.array(z.string()).max(4).optional(),
    needIds: z.array(z.string()).max(8).optional(),
    materialHint: z.string().trim().max(500).optional(),
    evidenceSignal: z.string().trim().max(300).optional(),
    minutes: z.number().int().min(1).max(120).nullish(),
    children: z.array(draftNodeSchema).max(12).optional(),
  }),
) as z.ZodType<DraftNode>;

export const treeDraftSchema = z.object({ modules: z.array(draftNodeSchema).min(2).max(10) });
export type TreeDraft = z.infer<typeof treeDraftSchema>;
