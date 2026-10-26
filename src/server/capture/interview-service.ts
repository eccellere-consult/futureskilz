import "server-only";

import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";

import { extractByRules, extractFollowUp, careerFactFromRole, type DraftFact } from "@/features/capture/extraction";
import { REQUIRED_CONSENTS, type ConsentPurpose, type ConsentState } from "@/features/capture/gates";
import {
  advance,
  applyPlan,
  beginSession,
  buildRecap,
  chooseElsewhere,
  confirmRolesText,
  newInterviewState,
  openQuestions,
  progressOf,
  startOrResume,
  type Effect,
  type Recap,
  type TurnInput,
} from "@/features/capture/planner";
import { readPlan } from "@/features/capture/plan";
import { PHASE_LABELS, getQuestion } from "@/features/capture/question-bank";
import { buildTimeline, roleCandidatesFromText, yearsLabel, type Timeline } from "@/features/capture/timeline";
import type { CareerRole, InterviewPlan, InterviewState, KnownFact, PlannerContext, Prompt, Segment } from "@/features/capture/types";
import {
  kcConsents,
  kcContributors,
  kcFactRevisions,
  kcFactSources,
  kcFacts,
  kcProjects,
  kcRoles,
  kcSegments,
  kcSessions,
  kcUploads,
  userRoles,
  users,
} from "@/server/db/schema";

import { readWithAi } from "./extract-ai";
import {
  CaptureError,
  audit,
  database,
  iso,
  loadRoles,
  newUuid,
  nextSeq,
  readState,
  requireProject,
  toSegment,
  type Executor,
  type ProjectRow,
  type Tx,
} from "./shared";

export const TERMS_VERSION = "2026-10-v1";

const WELCOME =
  "Hello, and thank you for being here. I am Arya, an AI interviewer, not a person. I will ask one question at a time, listen, and ask for an example when it helps. You can pause, skip, say you are not sure, or come back another day. Nothing is published without your review.";

export type PromptView = {
  id: string;
  kind: Prompt["kind"];
  text: string;
  why: string;
  phase: string | null;
  phaseLabel: string | null;
  roleLabel: string | null;
  options: Array<{ id: string; label: string }>;
  knownSummary: string | null;
  allowFreeText: boolean;
  /** Controls that make sense for this prompt. */
  controls: Array<"skip" | "unknown" | "confidential" | "revisit">;
};

export type InterviewView = {
  project: { id: string; title: string; status: string; language: string; sessionNumber: number; stage: string };
  prompt: PromptView | null;
  heard: string[];
  progress: ReturnType<typeof progressOf>;
  activeRole: { id: string; label: string } | null;
  recap: Recap | null;
  roles: Array<CareerRole & { years: string }>;
  timeline: Pick<Timeline, "flags" | "span">;
  transcript: Array<{ id: string; seq: number; speaker: "expert" | "companion"; text: string; at: string }>;
  stats: { facts: number; confirmed: number; pending: number; uploads: number; topicsCovered: number };
  openCount: number;
  consents: Partial<Record<ConsentPurpose, boolean>>;
  /** First name of the contributor, so Arya can greet them properly. */
  person: string;
  /** How the expert chose to shape the interview, if they have. */
  plan: InterviewPlan | null;
  /** True until the expert has either chosen a plan or answered anything: the moment for Arya's introduction. */
  needsPlan: boolean;
};

const roleName = (role: CareerRole): string => [role.title, role.company].filter(Boolean).join(" at ") || "Unnamed job";

async function currentConsents(executor: Executor, contributorId: string): Promise<ConsentState> {
  const rows = await executor.select().from(kcConsents).where(eq(kcConsents.contributorId, contributorId)).orderBy(asc(kcConsents.createdAt), asc(kcConsents.id));
  const state: ConsentState = {};
  for (const row of rows) state[row.purpose as ConsentPurpose] = row.granted;
  return state;
}

export { currentConsents };

async function knownFacts(executor: Executor, projectId: string): Promise<KnownFact[]> {
  const rows = await executor.select().from(kcFacts).where(and(eq(kcFacts.projectId, projectId), eq(kcFacts.kind, "source_fact")));
  return rows
    .filter((row) => row.reviewStatus !== "rejected")
    .map((row) => ({ id: row.id, category: row.category as KnownFact["category"], roleId: row.roleId, statement: row.statement, fromUpload: true, reviewStatus: row.reviewStatus }));
}

async function plannerContext(executor: Executor, projectId: string): Promise<PlannerContext> {
  return { roles: await loadRoles(executor, projectId), known: await knownFacts(executor, projectId), now: new Date().toISOString() };
}

function promptView(prompt: Prompt | null, roles: CareerRole[]): PromptView | null {
  if (!prompt || prompt.kind === "closing") return null;
  const role = prompt.roleId ? roles.find((item) => item.id === prompt.roleId) : undefined;
  const isQuestion = prompt.kind === "question" || prompt.kind === "followup";
  return {
    id: prompt.id,
    kind: prompt.kind,
    text: prompt.text,
    why: prompt.why,
    phase: prompt.phase ?? null,
    phaseLabel: prompt.phase ? PHASE_LABELS[prompt.phase] : null,
    roleLabel: role ? roleName(role) : null,
    options: prompt.options ?? [],
    knownSummary: prompt.knownSummary ?? null,
    allowFreeText: isQuestion && !(prompt.options && prompt.options.length > 0),
    controls: prompt.kind === "question" ? ["skip", "unknown", "confidential", "revisit"] : prompt.kind === "followup" && !prompt.options?.length ? ["skip"] : [],
  };
}

async function openSession(tx: Executor, projectId: string): Promise<{ id: string; number: number; startedAt: Date; endedAt: Date | null }> {
  const [latest] = await tx.select().from(kcSessions).where(eq(kcSessions.projectId, projectId)).orderBy(desc(kcSessions.number)).limit(1);
  return latest;
}

async function insertSegment(
  tx: Executor,
  projectId: string,
  sessionId: string | null,
  data: { id?: string; source: "interview" | "upload" | "correction"; speaker: "expert" | "companion"; text: string; modality?: "voice" | "text" | "system"; questionKey?: string | null; roleId?: string | null; locator?: string | null; uploadId?: string | null },
): Promise<Segment> {
  const id = data.id ?? newUuid();
  const seq = await nextSeq(tx, projectId);
  await tx.insert(kcSegments).values({
    id,
    projectId,
    sessionId,
    seq,
    source: data.source,
    speaker: data.speaker,
    text: data.text,
    modality: data.modality ?? (data.speaker === "companion" ? "system" : "text"),
    questionKey: data.questionKey ?? null,
    roleId: data.roleId ?? null,
    locator: data.locator ?? null,
    uploadId: data.uploadId ?? null,
  });
  const [row] = await tx.select().from(kcSegments).where(eq(kcSegments.id, id));
  return toSegment(row);
}

/** Saves the prompt the companion is about to show as part of the transcript, and returns it with its segment id. */
async function recordPrompt(tx: Executor, projectId: string, sessionId: string, prompt: Prompt, preface?: string): Promise<Prompt> {
  const segment = await insertSegment(tx, projectId, sessionId, {
    source: "interview",
    speaker: "companion",
    text: [preface, prompt.text].filter(Boolean).join(" "),
    questionKey: prompt.questionKey ?? null,
    roleId: prompt.roleId ?? null,
  });
  return { ...prompt, segmentId: segment.id };
}

async function insertFacts(tx: Executor, projectId: string, actorId: string | null, drafts: DraftFact[]): Promise<string[]> {
  const ids: string[] = [];
  // The same tool or measure mentioned again is one open question, not many.
  const existing = await tx.select({ category: kcFacts.category, title: kcFacts.title, details: kcFacts.details, status: kcFacts.reviewStatus }).from(kcFacts).where(and(eq(kcFacts.projectId, projectId), inArray(kcFacts.category, ["tool", "kpi"])));
  const seen = new Set(existing.filter((row) => row.status !== "rejected").map((row) => `${row.category}|${String((row.details as Record<string, unknown> | null)?.tool ?? row.title)}`.toLowerCase()));
  for (const draft of drafts) {
    if (draft.sources.length === 0) continue;
    if (draft.machineExtracted && draft.confidence === "low" && (draft.category === "tool" || draft.category === "kpi")) {
      const key = `${draft.category}|${String(draft.details?.tool ?? (draft.category === "kpi" ? draft.statement.slice(0, 80) : draft.title))}`.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
    }
    const id = newUuid();
    await tx.insert(kcFacts).values({
      id,
      projectId,
      roleId: draft.roleId,
      processId: draft.processId,
      category: draft.category,
      kind: draft.kind,
      title: draft.title.slice(0, 240),
      statement: draft.statement,
      details: draft.details ?? null,
      confidence: draft.confidence,
      reviewStatus: draft.reviewStatus,
      sensitivity: draft.sensitivity,
      // Boundaries the expert states about themselves are never published as content.
      permission: draft.category === "permission" ? "private" : "unset",
      machineExtracted: draft.machineExtracted,
    });
    for (const source of draft.sources) await tx.insert(kcFactSources).values({ factId: id, segmentId: source.segmentId, quote: source.quote });
    await tx.insert(kcFactRevisions).values({ factId: id, actorId, action: "create", after: { statement: draft.statement, reviewStatus: draft.reviewStatus }, reason: draft.machineExtracted ? "Proposed from the interview" : null });
    ids.push(id);
  }
  return ids;
}

async function applyEffects(tx: Executor, projectId: string, actorId: string, effects: Effect[]): Promise<void> {
  for (const effect of effects) {
    if (effect.type === "permission" && effect.segmentIds.length) {
      const links = await tx.select({ factId: kcFactSources.factId }).from(kcFactSources).where(inArray(kcFactSources.segmentId, effect.segmentIds));
      const factIds = Array.from(new Set(links.map((link) => link.factId)));
      if (factIds.length) {
        await tx.update(kcFacts).set({ permission: effect.permission, sensitivity: effect.permission === "public" ? "possible" : "confirmed" }).where(and(inArray(kcFacts.id, factIds), eq(kcFacts.projectId, projectId)));
        for (const factId of factIds) await tx.insert(kcFactRevisions).values({ factId, actorId, action: "permission", after: { permission: effect.permission }, reason: "Chosen in the interview" });
      }
    }
    if (effect.type === "known") {
      await tx.update(kcFacts).set({ reviewStatus: "confirmed", confidence: "high" }).where(and(eq(kcFacts.id, effect.factId), eq(kcFacts.projectId, projectId)));
      await tx.insert(kcFactRevisions).values({ factId: effect.factId, actorId, action: "confirm", reason: "Confirmed in the interview" });
    }
  }
}

/** A career walk-through becomes draft jobs for the contributor to correct. Nothing is trusted until they confirm it. */
async function addRoleCandidates(tx: Executor, projectId: string, segment: Segment): Promise<number> {
  const existing = await loadRoles(tx, projectId);
  const candidates = roleCandidatesFromText(segment.text);
  let order = existing.length;
  let added = 0;
  for (const candidate of candidates) {
    const duplicate = existing.some((role) => role.startYear === candidate.startYear && role.title.toLowerCase() === candidate.title.toLowerCase() && role.company.toLowerCase() === candidate.company.toLowerCase());
    if (duplicate) continue;
    await tx.insert(kcRoles).values({
      projectId,
      company: candidate.company,
      title: candidate.title,
      startYear: candidate.startYear,
      endYear: candidate.endYear,
      ongoing: candidate.ongoing,
      datesApproximate: candidate.datesApproximate,
      sortOrder: order++,
      sourceSegmentId: segment.id,
      confirmed: false,
    });
    added += 1;
  }
  return added;
}

export type CreateProjectInput = { title: string; language: string; publicName?: string; consents: ConsentState };

export async function createProject(userId: string, input: CreateProjectInput): Promise<{ projectId: string }> {
  const db = await database();
  const title = input.title.trim().slice(0, 200) || "My career";
  const missing = (["recording", "transcription", "ai_processing"] as const).filter((purpose) => !input.consents[purpose]);
  if (missing.length) throw new CaptureError(400, "To start, please agree to recording, transcription and AI processing. You can decide about lessons and publication later.");

  return db.transaction(async (tx) => {
    const [user] = await tx.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) throw new CaptureError(401, "Please sign in first.");
    await tx.insert(userRoles).values({ userId, role: "contributor" }).onDuplicateKeyUpdate({ set: { role: "contributor" } });
    await tx
      .insert(kcContributors)
      .values({ userId, publicName: (input.publicName?.trim() || user.displayName).slice(0, 160), language: input.language })
      .onDuplicateKeyUpdate({ set: { language: input.language, ...(input.publicName?.trim() ? { publicName: input.publicName.trim().slice(0, 160) } : {}) } });

    const projectId = newUuid();
    const state = newInterviewState();
    await tx.insert(kcProjects).values({ id: projectId, contributorId: userId, title, language: input.language, state: state as unknown as Record<string, unknown> });
    for (const purpose of [...REQUIRED_CONSENTS, "avatar_voice"] as ConsentPurpose[]) {
      if (input.consents[purpose] === undefined) continue;
      await tx.insert(kcConsents).values({ contributorId: userId, projectId, purpose, granted: !!input.consents[purpose], termsVersion: TERMS_VERSION });
    }
    const sessionId = newUuid();
    await tx.insert(kcSessions).values({ id: sessionId, projectId, number: 1 });
    await insertSegment(tx, projectId, sessionId, { source: "interview", speaker: "companion", text: WELCOME });

    const first = startOrResume(state, await plannerContext(tx, projectId));
    const prompt = await recordPrompt(tx, projectId, sessionId, first.prompt);
    first.state.prompt = prompt;
    await tx.update(kcProjects).set({ state: first.state as unknown as Record<string, unknown> }).where(eq(kcProjects.id, projectId));
    await audit(tx, userId, "project.create", "project", projectId, { termsVersion: TERMS_VERSION });
    return { projectId };
  });
}

export async function updateConsents(userId: string, projectId: string | null, consents: ConsentState): Promise<ConsentState> {
  const db = await database();
  if (projectId) await requireProject(db, userId, projectId);
  for (const [purpose, granted] of Object.entries(consents)) {
    if (typeof granted !== "boolean") continue;
    await db.insert(kcConsents).values({ contributorId: userId, projectId, purpose, granted, termsVersion: TERMS_VERSION });
    await audit(db, userId, granted ? "consent.grant" : "consent.withdraw", "project", projectId, { purpose });
  }
  return currentConsents(db, userId);
}

export async function listProjects(userId: string) {
  const db = await database();
  const rows = await db.select().from(kcProjects).where(eq(kcProjects.contributorId, userId)).orderBy(desc(kcProjects.updatedAt));
  const out = [];
  for (const row of rows) {
    const facts = await db.select({ status: kcFacts.reviewStatus, n: sql<number>`count(*)` }).from(kcFacts).where(eq(kcFacts.projectId, row.id)).groupBy(kcFacts.reviewStatus);
    const total = facts.reduce((sum, item) => sum + Number(item.n), 0);
    const confirmed = facts.filter((item) => item.status === "confirmed" || item.status === "corrected").reduce((sum, item) => sum + Number(item.n), 0);
    out.push({ id: row.id, title: row.title, status: row.status, stage: readState(row).stage, updatedAt: iso(row.updatedAt), facts: total, confirmed });
  }
  return out;
}

export async function getView(userId: string, projectId: string, extras: { heard?: string[]; recap?: Recap | null } = {}): Promise<InterviewView> {
  const db = await database();
  const project = await requireProject(db, userId, projectId);
  return buildView(db, project, extras);
}

async function firstNameOf(executor: Executor, userId: string): Promise<string> {
  const [row] = await executor.select({ name: users.displayName }).from(users).where(eq(users.id, userId)).limit(1);
  return (row?.name ?? "").trim().split(/\s+/)[0] ?? "";
}

async function buildView(executor: Executor, project: ProjectRow, extras: { heard?: string[]; recap?: Recap | null } = {}): Promise<InterviewView> {
  const state = readState(project);
  const roles = await loadRoles(executor, project.id);
  const ctx: PlannerContext = { roles, known: [], now: new Date().toISOString() };
  const session = await openSession(executor, project.id);
  const segments = await executor.select().from(kcSegments).where(and(eq(kcSegments.projectId, project.id), eq(kcSegments.source, "interview"))).orderBy(desc(kcSegments.seq)).limit(14);
  const facts = await executor.select({ status: kcFacts.reviewStatus, n: sql<number>`count(*)` }).from(kcFacts).where(eq(kcFacts.projectId, project.id)).groupBy(kcFacts.reviewStatus);
  const [uploadCount] = await executor.select({ n: sql<number>`count(*)` }).from(kcUploads).where(eq(kcUploads.projectId, project.id));
  const total = facts.reduce((sum, row) => sum + Number(row.n), 0);
  const confirmed = facts.filter((row) => row.status === "confirmed" || row.status === "corrected").reduce((sum, row) => sum + Number(row.n), 0);
  const activeRole = state.activeRoleId ? roles.find((role) => role.id === state.activeRoleId) : undefined;
  return {
    project: { id: project.id, title: project.title, status: project.status, language: project.language, sessionNumber: session?.number ?? 1, stage: state.stage },
    prompt: promptView(state.prompt, roles),
    heard: extras.heard ?? [],
    progress: progressOf(state),
    activeRole: activeRole ? { id: activeRole.id, label: roleName(activeRole) } : null,
    recap: extras.recap ?? null,
    roles: roles.map((role) => ({ ...role, years: yearsLabel(role) })),
    timeline: (({ flags, span }) => ({ flags, span }))(buildTimeline(roles)),
    transcript: segments.reverse().map((row) => ({ id: row.id, seq: row.seq, speaker: row.speaker, text: row.text, at: iso(row.createdAt) })),
    stats: {
      facts: total,
      confirmed,
      pending: total - confirmed - facts.filter((row) => row.status === "rejected").reduce((sum, row) => sum + Number(row.n), 0),
      uploads: Number(uploadCount?.n ?? 0),
      topicsCovered: Object.values(state.entries).filter((entry) => ["covered", "partial"].includes(entry.status)).length,
    },
    openCount: openQuestions(state, ctx, 100).length,
    consents: await currentConsents(executor, project.contributorId),
    person: await firstNameOf(executor, project.contributorId),
    plan: state.plan ?? null,
    needsPlan: !state.plan && state.sessionCount === 1 && Object.keys(state.entries).length === 0,
  };
}

/** Opens (or resumes) the interview: a new session on a later day starts with a short recap, and the saved question is offered again. */
export async function openInterview(userId: string, projectId: string): Promise<InterviewView> {
  const db = await database();
  return db.transaction(async (tx) => {
    const project = await requireProject(tx, userId, projectId, { forUpdate: true });
    if (project.status === "withdrawn") throw new CaptureError(409, "This interview was withdrawn.");
    let state = readState(project);
    const session = await openSession(tx, projectId);
    let recap: Recap | null = null;
    if (session && session.endedAt) {
      // The previous session ended: start the next one and remind the contributor where they stopped.
      const sessionId = newUuid();
      await tx.insert(kcSessions).values({ id: sessionId, projectId, number: session.number + 1 });
      state = beginSession(state);
      const ctx = await plannerContext(tx, projectId);
      recap = buildRecap(state, ctx);
      await insertSegment(tx, projectId, sessionId, { source: "interview", speaker: "companion", text: recap.line });
      if (state.prompt) {
        state.prompt = await recordPrompt(tx, projectId, sessionId, state.prompt, "Here is where we stopped.");
      }
      await tx.update(kcProjects).set({ state: state as unknown as Record<string, unknown> }).where(eq(kcProjects.id, projectId));
    }
    const fresh = await requireProject(tx, userId, projectId);
    return buildView(tx, fresh, { recap });
  });
}

export type TurnBody = {
  promptId: string;
  action: "answer" | "skip" | "unknown" | "confidential" | "revisit" | "choice" | "roles_confirmed" | "repeat";
  text?: string;
  optionId?: string;
  modality?: "voice" | "text";
};

export type TurnOutcome = { view: InterviewView; stale: boolean; finished: boolean };

const MAX_ANSWER = 8000;

export async function submitTurn(userId: string, projectId: string, body: TurnBody): Promise<TurnOutcome> {
  const db = await database();
  const project = await requireProject(db, userId, projectId);
  const before = readState(project);
  if (project.status === "withdrawn") throw new CaptureError(409, "This interview was withdrawn.");
  if (!before.prompt || before.prompt.id !== body.promptId) return { view: await buildView(db, project), stale: true, finished: false };
  if (body.action === "repeat") return { view: await buildView(db, project), stale: false, finished: false };

  const prompt = before.prompt;
  let text = "";
  let expert: Segment | null = null;
  let input: TurnInput;
  if (body.action === "answer") {
    text = (body.text ?? "").replace(/\u0000/g, "").trim();
    if (!text) throw new CaptureError(400, "Please say or type something first, or use Skip.");
    if (text.length > MAX_ANSWER) throw new CaptureError(413, "That answer is very long. Please split it into two parts.");
    expert = { id: newUuid(), seq: 0, source: "interview", speaker: "expert", text, roleId: prompt.roleId ?? null, questionKey: prompt.questionKey ?? null, createdAt: new Date().toISOString() };
    input = { kind: "answer", text, segmentId: expert.id };
  } else if (body.action === "choice") {
    if (!body.optionId || !prompt.options?.some((option) => option.id === body.optionId)) throw new CaptureError(400, "Please choose one of the options.");
    input = { kind: "choice", optionId: body.optionId };
  } else if (body.action === "roles_confirmed") {
    if (prompt.kind !== "confirm_roles") throw new CaptureError(400, "There is no timeline to confirm right now.");
    input = { kind: "roles_confirmed" };
  } else {
    input = { kind: body.action };
  }

  // The AI reading happens before the transaction opens so a slow model never holds a database connection.
  const def = prompt.questionKey ? getQuestion(prompt.questionKey) : undefined;
  const ai = expert && prompt.kind === "question" && def ? await readWithAi({ segments: [expert], question: def, roleId: prompt.roleId ?? null, processId: prompt.processId ?? null }) : null;

  return db.transaction(async (tx) => {
    const locked = await requireProject(tx, userId, projectId, { forUpdate: true });
    const state = readState(locked);
    if (!state.prompt || state.prompt.id !== body.promptId) return { view: await buildView(tx, locked), stale: true, finished: false };
    let session = await openSession(tx, projectId);
    if (!session || session.endedAt) {
      const sessionId = newUuid();
      const number = (session?.number ?? 0) + 1;
      await tx.insert(kcSessions).values({ id: sessionId, projectId, number });
      session = { id: sessionId, number, startedAt: new Date(), endedAt: null };
    }

    let saved: Segment | null = null;
    if (expert) {
      saved = await insertSegment(tx, projectId, session.id, { id: expert.id, source: "interview", speaker: "expert", text: expert.text, modality: body.modality === "voice" ? "voice" : "text", questionKey: expert.questionKey, roleId: expert.roleId });
    }

    const ctx = await plannerContext(tx, projectId);
    if (body.action === "roles_confirmed") await confirmRoles(tx, userId, projectId, state);
    const refreshed = body.action === "roles_confirmed" ? await plannerContext(tx, projectId) : ctx;
    const result = advance(state, input, refreshed);

    if (saved && prompt.kind === "question" && def) {
      const entry = result.state.entries[`${def.key}@${prompt.roleId ?? "-"}${prompt.processId ? `#${prompt.processId}` : ""}`];
      const label = prompt.processId ? result.state.processes.find((p) => p.id === prompt.processId)?.label ?? null : null;
      const rules = extractByRules({ segment: saved, question: def, roleId: prompt.roleId ?? null, processId: prompt.processId ?? null, processLabel: label, depthOk: (entry?.depth ?? 0) >= 0.55 });
      // When a model read the answer and every claim checked out, its granular facts replace the rule-based tool and
      // measure stubs; the answer itself is always kept in the contributor's own words.
      const drafts = ai && ai.facts.length ? [rules[0], ...ai.facts].filter(Boolean) : rules;
      await insertFacts(tx, projectId, userId, drafts);
      if (def.key === "c.walk") await addRoleCandidates(tx, projectId, saved);
      if (def.key === "c.walk" && result.prompt.kind === "confirm_roles") result.prompt.text = confirmRolesText((await loadRoles(tx, projectId)).length);
      if (ai && ai.rejected.length) await audit(tx, userId, "extraction.rejected", "project", projectId, { provider: ai.provider, model: ai.model, rejected: ai.rejected.slice(0, 8) });
    } else if (saved && prompt.kind === "followup") {
      const followUp = state.followUps.find((item) => item.id === prompt.followUpId);
      if (followUp && followUp.kind !== "sensitivity") await insertFacts(tx, projectId, userId, extractFollowUp(followUp.kind, saved, prompt.roleId ?? null, prompt.processId ?? null));
    }
    await applyEffects(tx, projectId, userId, result.effects);

    let nextPrompt = result.prompt;
    let finished = false;
    if (result.state.stage === "complete") finished = true;
    else if (nextPrompt.kind !== "closing") {
      nextPrompt = await recordPrompt(tx, projectId, session.id, nextPrompt, result.heard.join(" ") || undefined);
      result.state.prompt = nextPrompt;
    }

    await tx.update(kcProjects).set({ state: result.state as unknown as Record<string, unknown>, ...(finished ? { status: "in_review" } : {}) }).where(eq(kcProjects.id, projectId));
    if (finished) await tx.update(kcSessions).set({ endedAt: new Date() }).where(eq(kcSessions.id, session.id));
    const fresh = await requireProject(tx, userId, projectId);
    return { view: await buildView(tx, fresh, { heard: result.heard }), stale: false, finished };
  });
}

/** Confirming the timeline marks every job confirmed and records one career fact per job, sourced to where the job came from. */
async function confirmRoles(tx: Tx, userId: string, projectId: string, state: InterviewState): Promise<void> {
  const roles = await loadRoles(tx, projectId);
  const rows = await tx.select().from(kcRoles).where(eq(kcRoles.projectId, projectId));
  const walk = state.entries["c.walk@-"]?.segmentIds[0];
  const session = await openSession(tx, projectId);
  for (const role of roles) {
    if (role.confirmed) continue;
    const row = rows.find((item) => item.id === role.id);
    let source: Segment | undefined;
    const sourceId = row?.sourceSegmentId ?? walk;
    if (sourceId) {
      const [found] = await tx.select().from(kcSegments).where(eq(kcSegments.id, sourceId));
      if (found) source = toSegment(found);
    }
    if (!source || !row?.sourceSegmentId) {
      // A job the contributor typed in themselves is its own evidence: the correction is recorded as a segment.
      source = await insertSegment(tx, projectId, session?.id ?? null, {
        source: "correction",
        speaker: "expert",
        text: `${role.title || "Role"} at ${role.company || "employer"}, ${role.startYear ?? "?"} to ${role.ongoing ? "present" : (role.endYear ?? "?")}. Entered by the contributor.`,
        roleId: role.id,
      });
    }
    await tx.update(kcRoles).set({ confirmed: true }).where(eq(kcRoles.id, role.id));
    await insertFacts(tx, projectId, userId, [careerFactFromRole({ ...role, confirmed: true }, source, source.source === "correction" ? undefined : source.text.slice(0, 400))]);
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Timeline editing
// ---------------------------------------------------------------------------------------------------------------------

export type RoleInput = {
  id?: string;
  company?: string;
  title?: string;
  industry?: string;
  location?: string;
  startYear?: number | null;
  endYear?: number | null;
  ongoing?: boolean;
  datesApproximate?: boolean;
  summary?: string | null;
};

const clean = (value: unknown, max: number): string => (typeof value === "string" ? value.trim().slice(0, max) : "");
const year = (value: unknown): number | null => (typeof value === "number" && Number.isInteger(value) && value >= 1940 && value <= 2100 ? value : null);

export async function saveRole(userId: string, projectId: string, input: RoleInput): Promise<InterviewView> {
  const db = await database();
  await requireProject(db, userId, projectId);
  const values = {
    company: clean(input.company, 200),
    title: clean(input.title, 200),
    industry: clean(input.industry, 160),
    location: clean(input.location, 160),
    startYear: year(input.startYear),
    endYear: input.ongoing ? null : year(input.endYear),
    ongoing: !!input.ongoing,
    datesApproximate: !!input.datesApproximate,
    summary: input.summary ? clean(input.summary, 1000) : null,
  };
  if (!values.company && !values.title) throw new CaptureError(400, "Give the job at least an employer or a title.");
  if (input.id) {
    const [existing] = await db.select().from(kcRoles).where(and(eq(kcRoles.id, input.id), eq(kcRoles.projectId, projectId)));
    if (!existing) throw new CaptureError(404, "That job was not found.");
    await db.update(kcRoles).set(values).where(eq(kcRoles.id, input.id));
    await audit(db, userId, "role.update", "role", input.id, { before: { company: existing.company, title: existing.title, startYear: existing.startYear, endYear: existing.endYear } });
    // A confirmed job that changes must be re-confirmed so its career fact matches.
    if (existing.confirmed) await db.update(kcFacts).set({ reviewStatus: "needs_confirmation" }).where(and(eq(kcFacts.projectId, projectId), eq(kcFacts.roleId, input.id), eq(kcFacts.category, "career")));
  } else {
    const roles = await loadRoles(db, projectId);
    await db.insert(kcRoles).values({ projectId, ...values, sortOrder: roles.length, confirmed: false });
  }
  return buildView(db, await requireProject(db, userId, projectId));
}

export async function removeRole(userId: string, projectId: string, roleId: string): Promise<InterviewView> {
  const db = await database();
  await requireProject(db, userId, projectId);
  const [facts] = await db.select({ n: sql<number>`count(*)` }).from(kcFacts).where(and(eq(kcFacts.projectId, projectId), eq(kcFacts.roleId, roleId)));
  if (Number(facts?.n ?? 0) > 0) throw new CaptureError(409, "This job already has answers attached, so it cannot be deleted. Edit it instead, or reject its statements in your review.");
  await db.delete(kcRoles).where(and(eq(kcRoles.id, roleId), eq(kcRoles.projectId, projectId)));
  return buildView(db, await requireProject(db, userId, projectId));
}

// ---------------------------------------------------------------------------------------------------------------------
// Session control
// ---------------------------------------------------------------------------------------------------------------------

export async function finishSession(userId: string, projectId: string): Promise<{ summary: string; view: InterviewView }> {
  const db = await database();
  return db.transaction(async (tx) => {
    const project = await requireProject(tx, userId, projectId, { forUpdate: true });
    const session = await openSession(tx, projectId);
    if (!session) throw new CaptureError(409, "There is no session to finish.");
    const segments = await tx.select().from(kcSegments).where(and(eq(kcSegments.sessionId, session.id), eq(kcSegments.speaker, "expert"), eq(kcSegments.source, "interview")));
    const facts = await tx.select({ title: kcFacts.title }).from(kcFacts).innerJoin(kcFactSources, eq(kcFactSources.factId, kcFacts.id)).innerJoin(kcSegments, eq(kcSegments.id, kcFactSources.segmentId)).where(eq(kcSegments.sessionId, session.id));
    const topics = Array.from(new Set(facts.map((fact) => fact.title.replace(/:.*$/, "")))).slice(0, 8);
    const state = readState(project);
    const roles = await loadRoles(tx, projectId);
    const open = openQuestions(state, { roles, known: [], now: new Date().toISOString() }, 100).length;
    const summary = segments.length
      ? `In this session you answered ${segments.length} question${segments.length === 1 ? "" : "s"}${topics.length ? `, covering: ${topics.join("; ")}` : ""}. ${open ? `About ${open} topic${open === 1 ? "" : "s"} are still open for next time.` : "Nothing important is left open."} Please check it is accurate; you will review every statement before anything is published.`
      : "No answers were recorded in this session.";
    await tx.update(kcSessions).set({ endedAt: new Date(), summary }).where(eq(kcSessions.id, session.id));
    await insertSegment(tx, projectId, session.id, { source: "interview", speaker: "companion", text: `Session summary. ${summary}` });
    return { summary, view: await buildView(tx, await requireProject(tx, userId, projectId)) };
  });
}

/** The contributor says the session summary (or an earlier answer) was not right. The correction is evidence, appended, never overwritten. */
export async function addCorrection(userId: string, projectId: string, text: string, roleId?: string | null): Promise<void> {
  const db = await database();
  await requireProject(db, userId, projectId);
  const clean = text.trim().slice(0, 4000);
  if (clean.length < 3) throw new CaptureError(400, "Please describe what should be corrected.");
  const session = await openSession(db, projectId);
  await insertSegment(db, projectId, session?.id ?? null, { source: "correction", speaker: "expert", text: clean, roleId: roleId ?? null });
  await audit(db, userId, "correction.add", "project", projectId);
}

/** The expert chooses how the conversation is shaped. Takes effect from the next question; nothing already said is lost. */
export async function setInterviewPlan(userId: string, projectId: string, input: unknown): Promise<InterviewView> {
  const plan = readPlan(input);
  if (!plan) throw new CaptureError(400, "That plan could not be read.");
  const db = await database();
  return db.transaction(async (tx) => {
    const project = await requireProject(tx, userId, projectId, { forUpdate: true });
    const next = applyPlan(readState(project), plan);
    await tx.update(kcProjects).set({ state: next as unknown as Record<string, unknown> }).where(eq(kcProjects.id, projectId));
    await audit(tx, userId, "interview.plan", "project", projectId, { mode: plan.mode, skipped: plan.skipPhases.length, topics: plan.topics.length });
    return buildView(tx, await requireProject(tx, userId, projectId));
  });
}

export async function jumpTo(userId: string, projectId: string, roleId: string | null): Promise<InterviewView> {
  const db = await database();
  return db.transaction(async (tx) => {
    const project = await requireProject(tx, userId, projectId, { forUpdate: true });
    const state = readState(project);
    const ctx = await plannerContext(tx, projectId);
    if (roleId && !ctx.roles.some((role) => role.id === roleId)) throw new CaptureError(404, "That job was not found.");
    const session = await openSession(tx, projectId);
    const result = chooseElsewhere(state, ctx, roleId);
    result.state.prompt = await recordPrompt(tx, projectId, session.id, result.prompt);
    await tx.update(kcProjects).set({ state: result.state as unknown as Record<string, unknown> }).where(eq(kcProjects.id, projectId));
    return buildView(tx, await requireProject(tx, userId, projectId));
  });
}

export async function loadOpenQuestions(userId: string, projectId: string) {
  const db = await database();
  const project = await requireProject(db, userId, projectId);
  const roles = await loadRoles(db, projectId);
  return openQuestions(readState(project), { roles, known: [], now: new Date().toISOString() }, 40);
}

