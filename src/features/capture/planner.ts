import { PHASE_LABELS, QUESTION_BANK, ROLE_PHASE_ORDER, getQuestion, type QuestionDef } from "./question-bank";
import { metricMentions, missingExpectations, namedTools, readSensitivity, readSignals, sounds, specificity } from "./signals";
import {
  entryKey,
  type CareerRole,
  type EntryState,
  type Expectation,
  type FollowUp,
  type InterviewState,
  type KnownFact,
  type PhaseId,
  type PhaseProgress,
  type PlannerContext,
  type Prompt,
  type PromptOption,
} from "./types";

/**
 * The adaptive interviewer. It is a pure function of the saved state and what the expert just did, so it can be tested,
 * replayed and resumed on another day without the expert repeating anything.
 *
 * How it adapts:
 * 1. Follow-ups first. A thin answer, a metric, a named tool or a sensitive detail earns one targeted follow-up, never a
 *    generic "tell me more". Answers to follow-ups do not trigger more follow-ups, so the expert is not interrogated.
 * 2. Then the highest-value open question for the active job, scored by value, the expert's own stated focus, and flow.
 * 3. Questions already covered by an upload or an earlier answer become "is this right?" confirmations.
 * 4. The expert chooses the order of jobs and how deep to go; the core pass is the shortest credible route.
 */

const PROJECT_OPENING = ["a.teach", "a.topics", "a.limits", "b.first_job", "b.prepare", "b.day_one", "c.walk"];
const PROJECT_CLOSING = ["l.mentors", "m.wish", "o.journey", "o.strengths", "o.teach", "o.materials", "o.missing"];
const MAX_PROCESSES_PER_ROLE = 3;
const ATTEMPTED = new Set(["asked", "partial", "covered", "skipped", "unknown", "confidential", "not_applicable"]);

const newId = (): string => globalThis.crypto.randomUUID();

export function newInterviewState(): InterviewState {
  return {
    version: 1,
    stage: "welcome",
    goals: [],
    focusTerms: [],
    activeRoleId: null,
    deepRoleIds: [],
    roleOrder: [],
    doneRoleIds: [],
    processes: [],
    entries: {},
    followUps: [],
    askedAnchors: [],
    knownChecked: [],
    choices: {},
    prompt: null,
    sessionCount: 1,
    turnsThisSession: 0,
    lastPhase: null,
  };
}

/** What the expert did in response to the current prompt. */
export type TurnInput =
  | { kind: "answer"; text: string; segmentId: string }
  | { kind: "skip" }
  | { kind: "unknown" }
  | { kind: "confidential" }
  | { kind: "revisit" }
  | { kind: "choice"; optionId: string }
  | { kind: "roles_confirmed" };

/** Things the caller must do because of the turn (the planner itself never touches storage). */
export type Effect =
  | { type: "permission"; segmentIds: string[]; permission: "public" | "anonymize" | "private" }
  | { type: "known"; factId: string; accurate: boolean }
  | { type: "process_named"; processId: string; roleId: string; label: string }
  | { type: "goals"; goals: string[]; focusTerms: string[] };

export type TurnResult = {
  state: InterviewState;
  /** Short, factual lines the companion can say back ("Noted that you used SAP"). Built only from the expert's own words. */
  heard: string[];
  prompt: Prompt;
  effects: Effect[];
};

export function startOrResume(state: InterviewState, ctx: PlannerContext): TurnResult {
  const next = structuredClone(state);
  if (next.prompt && next.stage !== "welcome") {
    return { state: next, heard: [], prompt: next.prompt, effects: [] };
  }
  next.stage = "interviewing";
  const prompt = choosePrompt(next, ctx);
  next.prompt = prompt;
  return { state: next, heard: [], prompt, effects: [] };
}

/** A new session begins: keep the saved prompt, so the expert carries on exactly where they stopped. */
export function beginSession(state: InterviewState): InterviewState {
  const next = structuredClone(state);
  next.sessionCount += 1;
  next.turnsThisSession = 0;
  return next;
}

export function advance(state: InterviewState, input: TurnInput, ctx: PlannerContext): TurnResult {
  const next = structuredClone(state);
  const current = next.prompt;
  const effects: Effect[] = [];
  const heard: string[] = [];
  if (!current) return startOrResume(next, ctx);
  next.turnsThisSession += 1;

  switch (current.kind) {
    case "question":
      answerQuestion(next, current, input, ctx, heard, effects);
      break;
    case "followup":
      answerFollowUp(next, current, input, effects, heard);
      break;
    case "confirm_known":
      answerKnown(next, current, input, effects);
      break;
    case "confirm_roles":
      if (input.kind === "roles_confirmed") {
        next.roleOrder = [...ctx.roles].sort((a, b) => a.sortOrder - b.sortOrder).map((role) => role.id);
        next.choices["roles_confirmed@-"] = "yes";
      }
      break;
    case "choice":
      answerChoice(next, current, input, ctx);
      break;
    case "summary_check":
      if (input.kind === "choice" && input.optionId === "yes") {
        next.stage = "complete";
        next.choices["summary@-"] = "yes";
      } else if (input.kind === "choice") {
        // "Not yet": reopen every job for more depth and let the expert choose where to add.
        delete next.choices["summary@-"];
        for (const role of ctx.roles) reopenRole(next, role.id);
        next.activeRoleId = null;
      }
      break;
    case "closing":
      break;
  }

  const prompt = choosePrompt(next, ctx);
  next.prompt = prompt;
  next.lastPhase = prompt.phase ?? next.lastPhase;
  return { state: next, heard, prompt, effects };
}

// ---------------------------------------------------------------------------------------------------------------------
// Answering
// ---------------------------------------------------------------------------------------------------------------------

function setEntry(state: InterviewState, def: QuestionDef, roleId: string | null, processId: string | null, patch: Partial<EntryState>): EntryState {
  const key = entryKey(def.key, roleId, processId);
  const existing = state.entries[key];
  const entry: EntryState = existing
    ? { ...existing, ...patch }
    : { questionKey: def.key, roleId, processId, status: "asked", depth: 0, words: 0, segmentIds: [], missing: [], ...patch };
  state.entries[key] = entry;
  return entry;
}

function answerQuestion(
  state: InterviewState,
  prompt: Prompt,
  input: TurnInput,
  ctx: PlannerContext,
  heard: string[],
  effects: Effect[],
): void {
  const def = prompt.questionKey ? getQuestion(prompt.questionKey) : undefined;
  if (!def) return;
  const roleId = prompt.roleId ?? null;
  const processId = prompt.processId ?? null;
  const key = entryKey(def.key, roleId, processId);

  if (input.kind === "skip") {
    setEntry(state, def, roleId, processId, { status: "skipped" });
    return;
  }
  if (input.kind === "unknown") {
    setEntry(state, def, roleId, processId, { status: "unknown" });
    return;
  }
  if (input.kind === "confidential") {
    setEntry(state, def, roleId, processId, { status: "confidential" });
    return;
  }
  if (input.kind === "revisit") {
    setEntry(state, def, roleId, processId, { status: "revisit" });
    return;
  }
  if (input.kind !== "answer") return;

  const text = input.text.trim();
  if (!text) return;
  if (sounds(text) === "unknown" && text.split(/\s+/).length <= 8) {
    setEntry(state, def, roleId, processId, { status: "unknown", segmentIds: [...(state.entries[key]?.segmentIds ?? []), input.segmentId] });
    return;
  }

  const signals = readSignals(text);
  const depth = specificity(signals, def.expects, def.minWords);
  const missing = missingExpectations(signals, def.expects);
  const covered = depth >= 0.55;
  setEntry(state, def, roleId, processId, {
    status: covered ? "covered" : "partial",
    depth,
    words: signals.words,
    answeredAt: ctx.now,
    segmentIds: [...(state.entries[key]?.segmentIds ?? []), input.segmentId],
    missing,
  });

  captureSideEffects(state, def, roleId, processId, text, effects);
  const added = planFollowUps(state, def, roleId, processId, text, missing, covered);
  heard.push(...hearing(text, signals.hasDate, added));
}

function captureSideEffects(
  state: InterviewState,
  def: QuestionDef,
  roleId: string | null,
  processId: string | null,
  text: string,
  effects: Effect[],
): void {
  if (def.key === "a.topics" || def.key === "a.teach") {
    const terms = focusTermsFrom(text);
    state.focusTerms = Array.from(new Set([...state.focusTerms, ...terms])).slice(0, 24);
    if (def.key === "a.teach") state.goals = [...state.goals, text.slice(0, 280)].slice(-3);
    effects.push({ type: "goals", goals: state.goals, focusTerms: state.focusTerms });
  }
  if (def.key === "g.pick" && roleId && processId) {
    const label = processLabel(text);
    const existing = state.processes.find((process) => process.id === processId);
    if (existing) existing.label = label;
    else state.processes.push({ id: processId, roleId, label });
    effects.push({ type: "process_named", processId, roleId, label });
  }
}

export function processLabel(text: string): string {
  const first = text.trim().split(/[.\n!?]/)[0] ?? text;
  const cleaned = first.replace(/^(i would (like to )?(teach|say)|the|my|it'?s|it is)\s+/i, "").trim();
  return (cleaned || text).slice(0, 80);
}

const STOP = new Set(["the", "and", "for", "with", "that", "this", "about", "would", "like", "talk", "enjoy", "most", "have", "from", "into", "what", "which", "their", "your", "topics", "topic"]);

export function focusTermsFrom(text: string): string[] {
  return Array.from(new Set(text.toLowerCase().match(/[a-z][a-z-]{3,}/g) ?? [])).filter((word) => !STOP.has(word)).slice(0, 12);
}

function hearing(text: string, hasDate: boolean, added: FollowUp[]): string[] {
  const lines: string[] = [];
  const tools = namedTools(text);
  if (tools.length) lines.push(`You mentioned ${tools.slice(0, 3).join(", ")}.`);
  if (hasDate && lines.length === 0) lines.push("Dates noted.");
  if (added.some((followUp) => followUp.kind === "sensitivity")) lines.push("Some of this may be sensitive.");
  return lines.slice(0, 2);
}

const FOLLOW_UP_ORDER: Expectation[] = ["example", "steps", "outcome", "number", "tool", "date"];

const FOLLOW_UP_TEXT: Record<Expectation, { text: string; why: string }> = {
  example: { text: "Could you give me a recent or memorable example of that?", why: "A real example turns a general point into something a newcomer can copy." },
  steps: { text: "Could you take me through it in order, step by step?", why: "An ordered sequence is what makes a how-to usable." },
  outcome: { text: "What changed as a result? Anything measurable, or just what you saw?", why: "Results show whether the approach worked. A plain observation is fine." },
  number: { text: "Do you remember any numbers behind that, even roughly?", why: "Rough figures help, and I will mark them as approximate. I will not invent any." },
  tool: { text: "Which tool, system or template did you use for that?", why: "Naming the tool lets me link the step to the right tutorial." },
  date: { text: "Roughly when was that?", why: "Dates keep the timeline accurate. Approximate is fine." },
};

function planFollowUps(
  state: InterviewState,
  def: QuestionDef,
  roleId: string | null,
  processId: string | null,
  text: string,
  missing: Expectation[],
  covered: boolean,
): FollowUp[] {
  const parentKey = entryKey(def.key, roleId, processId);
  const added: FollowUp[] = [];
  const push = (followUp: Omit<FollowUp, "id" | "parentKey" | "roleId" | "processId" | "depth">) => {
    if (added.length >= 2) return;
    if (followUp.anchor && state.askedAnchors.includes(followUp.anchor)) return;
    if (followUp.anchor) state.askedAnchors.push(followUp.anchor);
    const item: FollowUp = { ...followUp, id: newId(), parentKey, roleId, processId, depth: 1 };
    state.followUps.push(item);
    added.push(item);
  };

  const sensitivity = readSensitivity(text);
  if (sensitivity.possible) {
    push({
      kind: "sensitivity",
      anchor: `sens:${parentKey}`,
      text: `That may be sensitive (${sensitivity.reasons.join(" and ")}). How should I treat it?`,
      why: "You decide what is shared. Anonymised means I remove names and identifying details.",
      options: [
        { id: "public", label: "It can be shared" },
        { id: "anonymize", label: "Share it anonymised" },
        { id: "private", label: "Keep it private" },
      ],
    });
  }

  const metric = metricMentions(text)[0];
  if (metric) {
    push({
      kind: "metric",
      anchor: `metric:${metric.phrase.slice(0, 60).toLowerCase()}`,
      text: `You mentioned a measure: "${metric.phrase}". How was it defined, and what were the baseline, target, period and result, as far as you know?`,
      why: "Definitions make a measure teachable. If you are not sure, say so and I will mark it unconfirmed.",
    });
  }

  const tool = namedTools(text)[0];
  if (tool && (def.produces.includes("tool") || def.produces.includes("process") || def.produces.includes("practice"))) {
    push({
      kind: "tool_use",
      anchor: `tool:${tool.toLowerCase()}`,
      text: `You mentioned ${tool}. How did you use it, who else used it, what went in and what came out?`,
      why: "Naming a tool is not the same as showing how it was used. This is the useful part.",
    });
  }

  if (!covered && missing.length > 0) {
    const kind = FOLLOW_UP_ORDER.find((expectation) => missing.includes(expectation));
    if (kind) {
      const copy = FOLLOW_UP_TEXT[kind];
      push({ kind, anchor: `gap:${parentKey}:${kind}`, text: copy.text, why: copy.why });
    }
  }
  return added;
}

function answerFollowUp(state: InterviewState, prompt: Prompt, input: TurnInput, effects: Effect[], heard: string[]): void {
  const followUp = state.followUps.find((item) => item.id === prompt.followUpId);
  state.followUps = state.followUps.filter((item) => item.id !== prompt.followUpId);
  if (!followUp) return;

  if (followUp.kind === "sensitivity") {
    if (input.kind === "choice" && ["public", "anonymize", "private"].includes(input.optionId)) {
      const parent = state.entries[followUp.parentKey];
      effects.push({ type: "permission", segmentIds: parent?.segmentIds ?? [], permission: input.optionId as "public" | "anonymize" | "private" });
      heard.push(input.optionId === "private" ? "I will keep that private." : input.optionId === "anonymize" ? "I will anonymise that." : "Noted that it can be shared.");
    }
    return;
  }

  if (input.kind === "answer") {
    const parent = state.entries[followUp.parentKey];
    if (parent) {
      parent.segmentIds = [...parent.segmentIds, input.segmentId];
      parent.words += input.text.trim().split(/\s+/).length;
      parent.missing = parent.missing.filter((expectation) => expectation !== followUp.kind);
      // A one-word reply to a follow-up does not turn a thin answer into a covered one.
      if (input.text.trim().split(/\s+/).length >= 6) {
        parent.depth = Math.max(parent.depth, 0.6);
        if (parent.status === "partial" || parent.status === "asked") parent.status = "covered";
      }
    }
    const sensitivity = readSensitivity(input.text);
    if (sensitivity.possible) {
      const item: FollowUp = {
        id: newId(),
        parentKey: followUp.parentKey,
        roleId: followUp.roleId,
        processId: followUp.processId,
        kind: "sensitivity",
        depth: 2,
        text: `That may be sensitive (${sensitivity.reasons.join(" and ")}). How should I treat it?`,
        why: "You decide what is shared.",
        options: [
          { id: "public", label: "It can be shared" },
          { id: "anonymize", label: "Share it anonymised" },
          { id: "private", label: "Keep it private" },
        ],
      };
      state.followUps.unshift(item);
    }
  }
}

function answerKnown(state: InterviewState, prompt: Prompt, input: TurnInput, effects: Effect[]): void {
  if (input.kind !== "choice") return;
  const def = prompt.questionKey ? getQuestion(prompt.questionKey) : undefined;
  if (!def) return;
  const roleId = prompt.roleId ?? null;
  const processId = prompt.processId ?? null;
  if (input.optionId === "accurate") {
    setEntry(state, def, roleId, processId, { status: "covered", depth: 1, answeredAt: new Date().toISOString() });
    if (prompt.knownFactId) effects.push({ type: "known", factId: prompt.knownFactId, accurate: true });
  } else if (input.optionId === "skip") {
    setEntry(state, def, roleId, processId, { status: "skipped" });
  }
  // "correct": leave the entry open; the real question is asked next, once, with the known text already on file.
}

function answerChoice(state: InterviewState, prompt: Prompt, input: TurnInput, ctx: PlannerContext): void {
  if (input.kind !== "choice" || !prompt.decision) return;
  const scope = prompt.processId ?? prompt.roleId ?? "-";
  state.choices[`${prompt.decision}@${scope}`] = input.optionId;

  if (prompt.decision === "next_role") {
    if (input.optionId === "summary") {
      state.activeRoleId = null;
      state.doneRoleIds = Array.from(new Set([...state.doneRoleIds, ...state.roleOrder]));
    } else state.activeRoleId = input.optionId;
  }
  if (prompt.decision === "go_deeper" && prompt.roleId) {
    if (input.optionId === "deeper") state.deepRoleIds = Array.from(new Set([...state.deepRoleIds, prompt.roleId]));
    else {
      state.doneRoleIds = Array.from(new Set([...state.doneRoleIds, prompt.roleId]));
      state.activeRoleId = null;
      if (input.optionId === "summary") state.doneRoleIds = Array.from(new Set([...state.doneRoleIds, ...ctx.roles.map((role) => role.id)]));
    }
  }
  if (prompt.decision === "leads_people" && prompt.roleId && input.optionId === "no") {
    for (const def of QUESTION_BANK.filter((question) => question.phase === "J")) {
      setEntry(state, def, prompt.roleId, null, { status: "not_applicable" });
    }
  }
  if (prompt.decision === "more_processes" && prompt.processId && input.optionId === "no") {
    // Remember that this role needs no further processes.
    state.choices[`more_processes_done@${prompt.roleId ?? "-"}`] = "yes";
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Choosing what to ask next
// ---------------------------------------------------------------------------------------------------------------------

function attempted(state: InterviewState, key: string, roleId: string | null, processId: string | null = null): boolean {
  const entry = state.entries[entryKey(key, roleId, processId)];
  return !!entry && ATTEMPTED.has(entry.status);
}

function eligible(state: InterviewState, def: QuestionDef, roleId: string | null, processId: string | null): boolean {
  const entry = state.entries[entryKey(def.key, roleId, processId)];
  if (entry && entry.status !== "revisit") return false;
  return (def.needs ?? []).every((need) => {
    const needDef = getQuestion(need);
    // A prerequisite in the same scope must be attempted; a project-level one is looked up without a role.
    if (needDef?.scope === "process") return attempted(state, need, roleId, processId);
    if (needDef?.scope === "project") return attempted(state, need, null, null);
    return attempted(state, need, roleId, null);
  });
}

function matchesFocus(state: InterviewState, def: QuestionDef): boolean {
  if (state.focusTerms.length === 0) return false;
  const haystack = [...(def.focus ?? []), PHASE_LABELS[def.phase].toLowerCase(), ...def.produces].join(" ");
  return state.focusTerms.some((term) => term.length > 3 && haystack.includes(term));
}

function score(state: InterviewState, def: QuestionDef, roleId: string | null, ctx: PlannerContext): number {
  const entry = state.entries[entryKey(def.key, roleId, null)];
  const phaseIndex = Math.max(0, ROLE_PHASE_ORDER.indexOf(def.phase));
  let value = def.weight;
  if (matchesFocus(state, def)) value += 3;
  if (state.lastPhase === def.phase) value += 1.5;
  if (entry?.status === "revisit") value -= 2;
  value -= phaseIndex * 0.35;
  if (ctx.minutesAvailable != null && ctx.minutesAvailable <= 10 && def.weight < 8) value -= 20;
  return value;
}

function roleLabel(role: CareerRole): string {
  return [role.title, role.company].filter(Boolean).join(" at ") || "this job";
}

function offerKnown(state: InterviewState, def: QuestionDef, roleId: string | null, ctx: PlannerContext): { fact: KnownFact } | null {
  if (!def.confirmable) return null;
  const key = entryKey(def.key, roleId, null);
  if (state.knownChecked.includes(key)) return null;
  // A document that is not tied to one job can answer for any job, but each fact is offered only once.
  const fact = ctx.known.find(
    (item) =>
      item.category === def.confirmable &&
      (item.roleId === roleId || item.roleId === null) &&
      item.fromUpload &&
      item.reviewStatus !== "rejected" &&
      !state.knownChecked.includes(`fact:${item.id}`),
  );
  return fact ? { fact } : null;
}

/** Brings a finished job back, set to go deeper, so the expert can add to it on another day. */
export function reopenRole(state: InterviewState, roleId: string): void {
  state.doneRoleIds = state.doneRoleIds.filter((id) => id !== roleId);
  if (!state.deepRoleIds.includes(roleId)) state.deepRoleIds.push(roleId);
  delete state.choices[`go_deeper@${roleId}`];
  if (!state.roleOrder.includes(roleId)) state.roleOrder.push(roleId);
}

/** Drops the question on screen and lets the expert pick a job, e.g. from the recap's "choose another section". */
export function chooseElsewhere(state: InterviewState, ctx: PlannerContext, roleId: string | null): TurnResult {
  const next = structuredClone(state);
  if (roleId) {
    reopenRole(next, roleId);
    next.activeRoleId = roleId;
  } else next.activeRoleId = null;
  const prompt = choosePrompt(next, ctx);
  next.prompt = prompt;
  next.lastPhase = prompt.phase ?? next.lastPhase;
  return { state: next, heard: [], prompt, effects: [] };
}

function questionPrompt(def: QuestionDef, roleId: string | null, processId: string | null, preface?: string): Prompt {
  return {
    id: newId(),
    kind: "question",
    text: preface ? `${preface} ${def.text}` : def.text,
    why: def.why,
    questionKey: def.key,
    roleId,
    processId,
    phase: def.phase,
  };
}

function choose(id: string, label: string): PromptOption {
  return { id, label };
}

function rolesLeft(state: InterviewState, ctx: PlannerContext): CareerRole[] {
  return state.roleOrder
    .map((id) => ctx.roles.find((role) => role.id === id))
    .filter((role): role is CareerRole => !!role && !state.doneRoleIds.includes(role.id));
}

/** The next open question for the active role, or the choice that moves the interview on. */
function roleStep(state: InterviewState, ctx: PlannerContext, role: CareerRole): Prompt | null {
  const deep = state.deepRoleIds.includes(role.id);
  const leadsAnswer = state.choices[`leads_people@${role.id}`];
  const label = roleLabel(role);

  // Role-scoped questions (everything except the process phase)
  const candidates: Array<{ def: QuestionDef; processId: string | null; value: number }> = [];
  for (const def of QUESTION_BANK) {
    if (def.scope !== "role") continue;
    if (def.tier === "deep" && !deep) continue;
    if (def.phase === "J" && leadsAnswer === "no") continue;
    if (!eligible(state, def, role.id, null)) continue;
    if (def.phase === "J" && leadsAnswer === undefined) continue;
    candidates.push({ def, processId: null, value: score(state, def, role.id, ctx) });
  }

  // Process-scoped questions: continue the process in progress, or start the first one.
  const processes = state.processes.filter((process) => process.roleId === role.id);
  const picks = Object.values(state.entries).filter((entry) => entry.questionKey === "g.pick" && entry.roleId === role.id);
  if (picks.length === 0 && attempted(state, "f.duties", role.id)) {
    const def = getQuestion("g.pick")!;
    candidates.push({ def, processId: newId(), value: score(state, def, role.id, ctx) + 1 });
  }
  for (const process of processes) {
    for (const def of QUESTION_BANK.filter((question) => question.scope === "process" && question.key !== "g.pick")) {
      if (def.tier === "deep" && !deep) continue;
      if (!eligible(state, def, role.id, process.id)) continue;
      candidates.push({ def, processId: process.id, value: score(state, def, role.id, ctx) + 2 });
    }
  }

  // J needs a yes/no first: did the expert lead people in this role?
  if (leadsAnswer === undefined && attempted(state, "f.duties", role.id)) {
    return {
      id: newId(),
      kind: "choice",
      decision: "leads_people",
      roleId: role.id,
      phase: "J",
      text: `In this role, did you lead or manage people?`,
      why: "If you did, I will ask about people and teamwork. If not, I will skip that part.",
      options: [choose("yes", "Yes, I led people"), choose("no", "No, I did not")],
    };
  }

  if (candidates.length > 0) {
    candidates.sort((a, b) => b.value - a.value);
    const best = candidates[0];
    const known = offerKnown(state, best.def, role.id, ctx);
    if (known) {
      state.knownChecked.push(entryKey(best.def.key, role.id, null), `fact:${known.fact.id}`);
      return {
        id: newId(),
        kind: "confirm_known",
        text: `I already have this from your material: "${known.fact.statement.slice(0, 220)}". Is that right?`,
        why: "You should not have to say it twice. Confirm it, or tell me what to change.",
        questionKey: best.def.key,
        roleId: role.id,
        phase: best.def.phase,
        knownSummary: known.fact.statement,
        knownFactId: known.fact.id,
        options: [choose("accurate", "Yes, that is right"), choose("correct", "It needs a correction"), choose("skip", "Skip for now")],
      };
    }
    const preface = state.lastPhase !== best.def.phase && best.def.scope !== "project" ? `About your time as ${label}.` : undefined;
    return questionPrompt(best.def, role.id, best.processId, best.processId && best.def.key !== "g.pick" ? `On "${state.processes.find((p) => p.id === best.processId)?.label ?? "this process"}":` : preface);
  }

  // Another process? Asked once per finished process, up to a small cap.
  const lastProcess = [...processes].reverse().find((process) => attempted(state, "g.example", role.id, process.id));
  if (
    lastProcess &&
    processes.length < MAX_PROCESSES_PER_ROLE &&
    state.choices[`more_processes@${lastProcess.id}`] === undefined &&
    state.choices[`more_processes_done@${role.id}`] === undefined
  ) {
    return {
      id: newId(),
      kind: "choice",
      decision: "more_processes",
      roleId: role.id,
      processId: lastProcess.id,
      phase: "G",
      text: `Is there another process from your time as ${label} that you would like to teach?`,
      why: "Each process becomes its own short lesson, so more of them means more for learners.",
      options: [choose("yes", "Yes, another process"), choose("no", "No, that is enough for now")],
    };
  }
  if (
    lastProcess &&
    state.choices[`more_processes@${lastProcess.id}`] === "yes" &&
    picks.length === processes.length &&
    processes.every((process) => attempted(state, "g.example", role.id, process.id)) &&
    processes.length < MAX_PROCESSES_PER_ROLE
  ) {
    // The expert asked for another process: open a fresh one.
    const def = getQuestion("g.pick")!;
    return questionPrompt(def, role.id, newId(), "Let's add another process.");
  }

  // The pass for this role is complete: let the expert decide how to continue.
  if (state.choices[`go_deeper@${role.id}`] === undefined) {
    const others = rolesLeft(state, ctx).filter((item) => item.id !== role.id);
    const options: PromptOption[] = [];
    if (!deep) options.push(choose("deeper", `Go deeper on ${label}`));
    options.push(choose("next", others.length ? "Move to another job" : "Move to my career summary"));
    if (others.length) options.push(choose("summary", "Skip to my career summary"));
    return {
      id: newId(),
      kind: "choice",
      decision: "go_deeper",
      roleId: role.id,
      phase: "N",
      text: deep
        ? `That covers ${label} in depth. Shall we move on?`
        : `That is the essential picture of ${label}. Would you like to go deeper here, or move on?`,
      why: "Going deeper adds detail for learners. Moving on keeps this session short. You can come back later.",
      options,
    };
  }
  // Deep pass finished: close the role quietly.
  if (deep) {
    state.doneRoleIds.push(role.id);
    state.activeRoleId = null;
  }
  return null;
}

export function confirmRolesText(count: number): string {
  return count > 0
    ? `Here is the timeline I drew from what you told me. Please correct anything, add missing jobs, and choose "This looks right" when done.`
    : `I could not pick out individual jobs from that. Please add each job below, with employer, title and years, even roughly.`;
}

export function choosePrompt(state: InterviewState, ctx: PlannerContext): Prompt {
  // 1) A pending follow-up always comes first.
  const followUp = state.followUps[0];
  if (followUp) {
    return {
      id: newId(),
      kind: "followup",
      text: followUp.text,
      why: followUp.why,
      followUpId: followUp.id,
      questionKey: undefined,
      roleId: followUp.roleId,
      processId: followUp.processId,
      phase: state.lastPhase ?? undefined,
      options: followUp.options,
      decision: followUp.kind === "sensitivity" ? "sensitivity" : undefined,
    };
  }

  // 2) Opening: goals, how the career began, the walk through the career.
  for (const key of PROJECT_OPENING) {
    const def = getQuestion(key)!;
    if (!attempted(state, key, null) && !(state.entries[entryKey(key, null, null)]?.status === "revisit")) {
      return questionPrompt(def, null, null);
    }
  }

  // 3) Confirm the draft timeline once; the expert fixes names and years before any deep dive.
  if (state.choices["roles_confirmed@-"] === undefined) {
    return {
      id: newId(),
      kind: "confirm_roles",
      text: confirmRolesText(ctx.roles.length),
      why: "Everything we explore next hangs on these jobs, so it is worth getting them right once.",
      phase: "C",
    };
  }

  // 4) The job loop. Jobs added or removed in the timeline after it was confirmed join or leave the order.
  state.roleOrder = [
    ...state.roleOrder.filter((id) => ctx.roles.some((role) => role.id === id)),
    ...[...ctx.roles].sort((a, b) => a.sortOrder - b.sortOrder).map((role) => role.id).filter((id) => !state.roleOrder.includes(id)),
  ];
  const remaining = rolesLeft(state, ctx);
  if (remaining.length > 0) {
    if (!state.activeRoleId || state.doneRoleIds.includes(state.activeRoleId) || !ctx.roles.some((role) => role.id === state.activeRoleId)) {
      state.activeRoleId = null;
      if (remaining.length === 1 && state.roleOrder.length === 1) state.activeRoleId = remaining[0].id;
      else {
        return {
          id: newId(),
          kind: "choice",
          decision: "next_role",
          phase: "C",
          text: state.doneRoleIds.length === 0 ? "Which job would you like to explore first?" : "Which job would you like to explore next?",
          why: "Pick the one where you learned the most. Others can wait for another day.",
          options: [...remaining.map((role) => choose(role.id, roleLabel(role))), choose("summary", "None for now, go to my career summary")],
        };
      }
    }
    const role = ctx.roles.find((item) => item.id === state.activeRoleId)!;
    const step = roleStep(state, ctx, role);
    if (step) return step;
    // The role closed itself (deep pass finished) or the expert moved on: pick again.
    return choosePrompt(state, ctx);
  }

  // 5) Whole-career closing questions, then the summary check.
  for (const key of PROJECT_CLOSING) {
    const def = getQuestion(key)!;
    if (def.tier === "deep" && state.deepRoleIds.length === 0) continue;
    if (!attempted(state, key, null) && !(state.entries[entryKey(key, null, null)]?.status === "revisit")) {
      return questionPrompt(def, null, null);
    }
  }
  if (state.choices["summary@-"] === undefined) {
    return {
      id: newId(),
      kind: "summary_check",
      text: "That is everything on my list. I will now write up what I heard, and you will see it for correction before anything is published. Shall I go ahead?",
      why: "You review and correct every fact before it can be used in a lesson.",
      phase: "O",
      options: [choose("yes", "Yes, prepare my review"), choose("later", "Not yet, I want to add more")],
    };
  }
  return { id: newId(), kind: "closing", text: "Thank you. Your review is being prepared.", why: "", phase: "O" };
}

// ---------------------------------------------------------------------------------------------------------------------
// Progress, recap, gaps
// ---------------------------------------------------------------------------------------------------------------------

function phaseStatus(state: InterviewState, phase: PhaseId, roleId: string | null, current: PhaseId | undefined): PhaseProgress["status"] {
  if (roleId && phase === "J" && state.choices[`leads_people@${roleId}`] === "no") return "not_applicable";
  const defs = QUESTION_BANK.filter((question) => question.phase === phase && question.tier === "core");
  const processIds = state.processes.filter((process) => process.roleId === roleId).map((process) => process.id);
  let total = 0;
  let done = 0;
  for (const def of defs) {
    const scopes = def.scope === "process" ? (processIds.length ? processIds : [null]) : [null];
    for (const processId of scopes) {
      total += 1;
      if (attempted(state, def.key, def.scope === "project" ? null : roleId, def.scope === "process" ? processId : null)) done += 1;
    }
  }
  if (phase === current && done < total) return "current";
  if (done === total && total > 0) return "done";
  if (done > 0) return "partial";
  return phase === current ? "current" : "upcoming";
}

/** Progress by phase, never a percentage of an enormous interview. */
export function progressOf(state: InterviewState): PhaseProgress[] {
  const current = state.prompt?.phase;
  const out: PhaseProgress[] = [];
  for (const phase of ["A", "B", "C"] as PhaseId[]) out.push({ phase, label: PHASE_LABELS[phase], status: phaseStatus(state, phase, null, current) });
  const roleId = state.activeRoleId;
  if (roleId) for (const phase of ROLE_PHASE_ORDER.filter((item) => item !== "C")) out.push({ phase, label: PHASE_LABELS[phase], status: phaseStatus(state, phase, roleId, current) });
  for (const phase of ["L", "O"] as PhaseId[]) out.push({ phase, label: PHASE_LABELS[phase], status: phaseStatus(state, phase, null, current) });
  return out;
}

export type Recap = {
  /** What was covered, in the expert's terms. */
  covered: string[];
  /** What is still open, by job. */
  open: string[];
  line: string;
  options: PromptOption[];
};

export function buildRecap(state: InterviewState, ctx: PlannerContext): Recap {
  const covered: string[] = [];
  const open: string[] = [];
  const projectDone = [...PROJECT_OPENING, ...PROJECT_CLOSING].filter((key) => attempted(state, key, null));
  if (projectDone.some((key) => key.startsWith("b."))) covered.push("how your career began");
  if (state.roleOrder.length) covered.push(`a draft timeline of ${state.roleOrder.length} job${state.roleOrder.length === 1 ? "" : "s"}`);
  for (const role of ctx.roles) {
    const entries = Object.values(state.entries).filter((entry) => entry.roleId === role.id && ATTEMPTED.has(entry.status));
    if (entries.length) covered.push(`${entries.length} topic${entries.length === 1 ? "" : "s"} about ${roleLabel(role)}`);
    const left = QUESTION_BANK.filter((def) => def.scope === "role" && def.tier === "core" && !(def.phase === "J" && state.choices[`leads_people@${role.id}`] === "no") && !attempted(state, def.key, role.id)).length;
    if (entries.length && left) open.push(`${left} more about ${roleLabel(role)}`);
  }
  const thin = Object.values(state.entries).filter((entry) => entry.status === "partial" || entry.status === "revisit").length;
  if (thin) open.push(`${thin} answer${thin === 1 ? "" : "s"} you may want to add to`);
  const phase = state.prompt?.phase ? PHASE_LABELS[state.prompt.phase] : null;
  const head = covered.length ? `Last time we covered ${covered.slice(0, 3).join(", ")}.` : "Welcome back.";
  const tail = open.length ? ` Still open: ${open.slice(0, 2).join(" and ")}.` : "";
  return {
    covered,
    open,
    line: `${head}${tail} Would you like to carry on${phase ? ` with ${phase.toLowerCase()}` : ""}, or choose another section?`,
    options: [choose("continue", "Carry on where we stopped"), choose("choose", "Choose another section")],
  };
}

export type OpenQuestion = { roleId: string | null; questionKey: string; text: string; reason: string; priority: number };

/** Prioritised list of what is still missing: unasked core questions, thin answers, skipped and "revisit" items. */
export function openQuestions(state: InterviewState, ctx: PlannerContext, limit = 25): OpenQuestion[] {
  const out: OpenQuestion[] = [];
  for (const role of ctx.roles) {
    if (!state.roleOrder.includes(role.id)) continue;
    for (const def of QUESTION_BANK) {
      if (def.scope !== "role" || def.tier !== "core") continue;
      if (def.phase === "J" && state.choices[`leads_people@${role.id}`] === "no") continue;
      const entry = state.entries[entryKey(def.key, role.id, null)];
      let reason: string | null = null;
      if (!entry) reason = "not yet asked";
      else if (entry.status === "partial") reason = `answer was brief${entry.missing.length ? `, missing ${entry.missing.join(", ")}` : ""}`;
      else if (entry.status === "skipped") reason = "skipped for now";
      else if (entry.status === "revisit") reason = "marked to revisit";
      else if (entry.status === "unknown") reason = "contributor was not sure";
      if (reason) out.push({ roleId: role.id, questionKey: def.key, text: def.text, reason, priority: def.weight - (entry ? 0 : 0.5) });
    }
  }
  return out.sort((a, b) => b.priority - a.priority).slice(0, limit);
}

export function roleLabelFor(role: CareerRole): string {
  return roleLabel(role);
}
