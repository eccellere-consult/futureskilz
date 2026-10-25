/**
 * Shared vocabulary of the expert capture workflow. Everything under src/features/capture is plain TypeScript with no
 * database or framework imports, so the interview, the knowledge rules and the earnings maths run (and are tested) anywhere.
 */

export type PhaseId = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I" | "J" | "K" | "L" | "M" | "N" | "O";

/** `project` questions are asked once per interview; `role` questions once per job or career phase; `process` once per process. */
export type Scope = "project" | "role" | "process";

export type Expectation = "example" | "steps" | "number" | "tool" | "outcome" | "date";

/** The kinds of knowledge the interview turns into structured facts (the Step 4 records of the skill). */
export type FactCategory =
  | "career"
  | "industry"
  | "function"
  | "process"
  | "role"
  | "kpi"
  | "practice"
  | "tool"
  | "case"
  | "skill"
  | "tacit"
  | "mistake"
  | "leadership"
  | "training"
  | "permission";

/**
 * How the system knows a fact. A reader must always be able to tell the expert's own words from a machine's reading of them.
 * - direct_statement: the contributor said it (a quote is linked).
 * - source_fact: an uploaded document states it (a location in the document is linked).
 * - ai_synthesis: the system combined or interpreted sources; it is shown apart until the contributor confirms it.
 * - editorial: an editor's recommendation, never presented as the contributor's claim.
 */
export type FactKind = "direct_statement" | "source_fact" | "ai_synthesis" | "editorial";

export type ReviewStatus = "proposed" | "needs_confirmation" | "confirmed" | "corrected" | "rejected";

export type Confidence = "high" | "medium" | "low";

/** What the contributor allows for a fact: public, public in anonymised words, or kept private (the safe default). */
export type PublishPermission = "unset" | "public" | "anonymize" | "private";

export type Sensitivity = "none" | "possible" | "confirmed";

export type SegmentSource = "interview" | "upload" | "correction";

export type Speaker = "expert" | "companion";

/** One immutable piece of source evidence. Facts point at these; they are never rewritten. */
export type Segment = {
  id: string;
  seq: number;
  source: SegmentSource;
  speaker: Speaker;
  text: string;
  /** Page, slide, sheet or row for an upload; empty for the interview. */
  locator?: string | null;
  uploadId?: string | null;
  roleId?: string | null;
  questionKey?: string | null;
  createdAt: string;
};

export type SourceLink = { segmentId: string; quote: string };

export type Fact = {
  id: string;
  category: FactCategory;
  kind: FactKind;
  title: string;
  statement: string;
  details?: Record<string, unknown> | null;
  roleId?: string | null;
  processId?: string | null;
  confidence: Confidence;
  reviewStatus: ReviewStatus;
  sensitivity: Sensitivity;
  permission: PublishPermission;
  anonymizedStatement?: string | null;
  sources: SourceLink[];
  /** True when the fact came from rules or an AI reading of the transcript rather than from the contributor typing it in. */
  machineExtracted: boolean;
  version: number;
};

export type CareerRole = {
  id: string;
  company: string;
  title: string;
  industry: string;
  location: string;
  /** Approximate dates stay approximate: a year, optionally a month, and a flag the contributor can clear. */
  startYear: number | null;
  endYear: number | null;
  ongoing: boolean;
  datesApproximate: boolean;
  summary?: string | null;
  sortOrder: number;
  confirmed: boolean;
};

export type ProcessRef = { id: string; roleId: string; label: string };

export type EntryStatus = "asked" | "partial" | "covered" | "skipped" | "unknown" | "confidential" | "revisit" | "not_applicable";

/** What the interview knows about one question for one role (or process). Keyed by `entryKey`. */
export type EntryState = {
  questionKey: string;
  roleId: string | null;
  processId: string | null;
  status: EntryStatus;
  /** Rule-based reading of how specific the answer was: 0 (thin) to 1 (example, numbers and outcome all present). */
  depth: number;
  words: number;
  answeredAt?: string;
  segmentIds: string[];
  /** Which expected signals were still missing when the answer ended (used to word the follow-up). */
  missing: Expectation[];
};

export type FollowUpKind = "example" | "steps" | "number" | "tool" | "outcome" | "date" | "metric" | "tool_use" | "sensitivity";

export type FollowUp = {
  id: string;
  parentKey: string;
  roleId: string | null;
  processId: string | null;
  kind: FollowUpKind;
  text: string;
  why: string;
  /** Phrase from the expert's own answer the follow-up refers to, so the same phrase is never asked about twice. */
  anchor?: string;
  depth: number;
  options?: PromptOption[];
};

export type PromptKind = "question" | "followup" | "confirm_roles" | "confirm_known" | "choice" | "summary_check" | "closing";

export type PromptOption = { id: string; label: string };

/** What the companion says next. Exactly one is current at a time. */
export type Prompt = {
  id: string;
  kind: PromptKind;
  text: string;
  why: string;
  questionKey?: string;
  roleId?: string | null;
  processId?: string | null;
  phase?: PhaseId;
  followUpId?: string;
  options?: PromptOption[];
  /** For confirm_known: the fact the expert already gave, shown instead of asking again. */
  knownSummary?: string;
  knownFactId?: string;
  /** The companion segment that recorded this prompt in the transcript. */
  segmentId?: string;
  /** For choice prompts: which decision the answer drives. */
  decision?: "next_role" | "more_processes" | "leads_people" | "go_deeper" | "resume" | "sensitivity";
};

export type InterviewStage = "welcome" | "interviewing" | "wrapping" | "complete";

/** The checkpoint saved after every turn. Resuming loads this; nothing the expert said needs repeating. */
export type InterviewState = {
  version: 1;
  stage: InterviewStage;
  goals: string[];
  /** Topics the expert said they most want to discuss (from phase A); they raise the priority of matching questions. */
  focusTerms: string[];
  activeRoleId: string | null;
  /** Roles the expert asked to be taken deeper (after the core pass). */
  deepRoleIds: string[];
  roleOrder: string[];
  doneRoleIds: string[];
  processes: ProcessRef[];
  entries: Record<string, EntryState>;
  followUps: FollowUp[];
  askedAnchors: string[];
  /** Entry keys for which "I already have this, is it right?" was offered, so it is offered once. */
  knownChecked: string[];
  /** Answers to click-through choices, keyed by `${decision}@${roleId|processId|-}`. */
  choices: Record<string, string>;
  prompt: Prompt | null;
  sessionCount: number;
  turnsThisSession: number;
  lastPhase: PhaseId | null;
};

export type PhaseProgress = {
  phase: PhaseId;
  label: string;
  status: "done" | "current" | "partial" | "upcoming" | "not_applicable";
};

export type PlannerContext = {
  roles: CareerRole[];
  /** Facts the contributor already has on file (from uploads or earlier answers) used to confirm rather than re-ask. */
  known: KnownFact[];
  minutesAvailable?: number | null;
  now: string;
};

/** A fact the planner may offer for confirmation instead of asking again. */
export type KnownFact = {
  id: string;
  category: FactCategory;
  roleId: string | null;
  statement: string;
  fromUpload: boolean;
  reviewStatus: ReviewStatus;
};

export const entryKey = (questionKey: string, roleId: string | null, processId: string | null): string =>
  `${questionKey}@${roleId ?? "-"}${processId ? `#${processId}` : ""}`;
