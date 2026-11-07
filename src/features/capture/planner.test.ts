import { describe, expect, it } from "vitest";

import { role } from "./fixtures";
import { advance, buildRecap, newInterviewState, openQuestions, progressOf, startOrResume, type TurnInput } from "./planner";
import { getQuestion } from "./question-bank";
import { entryKey, type CareerRole, type InterviewState, type KnownFact, type PlannerContext } from "./types";

type Turn = ReturnType<typeof advance>;

const ctxOf = (roles: CareerRole[] = [], known: KnownFact[] = []): PlannerContext => ({ roles, known, now: "2026-10-25T10:00:00.000Z" });
let n = 0;
const say = (text: string): TurnInput => ({ kind: "answer", text, segmentId: `s${++n}` });
const LONG = "In my plant we used SAP for planning. First we checked demand, then we scheduled the lines, then we released orders and finally reviewed the schedule every morning. For example, once we cut changeover time by 20 percent and the result was fewer late orders.";

/** Runs the interview until it reaches `until` or a safety limit, answering every question with `answer`. */
function auto(text: string): (turn: Turn) => TurnInput {
  return (turn) =>
    turn.prompt.kind === "confirm_roles"
      ? { kind: "roles_confirmed" }
      : turn.prompt.kind === "choice" || turn.prompt.kind === "summary_check"
        ? { kind: "choice", optionId: turn.prompt.options![0].id }
        : say(text);
}

function drive(state: InterviewState, ctx: PlannerContext, answer: (turn: Turn) => TurnInput, until: (turn: Turn) => boolean, limit = 600): { state: InterviewState; asked: string[]; last: Turn } {
  let turn = startOrResume(state, ctx);
  const asked: string[] = [];
  for (let i = 0; i < limit; i += 1) {
    const p = turn.prompt;
    if (p.questionKey) asked.push(entryKey(p.questionKey, p.roleId ?? null, p.processId ?? null));
    if (until(turn)) break;
    turn = advance(turn.state, answer(turn), ctx);
  }
  return { state: turn.state, asked, last: turn };
}

describe("adaptive planner", () => {
  it("opens with the expert's goals, not a form", () => {
    const turn = startOrResume(newInterviewState(), ctxOf());
    expect(turn.prompt.questionKey).toBe("a.teach");
    expect(turn.prompt.why.length).toBeGreaterThan(10);
  });

  it("asks one targeted follow-up for a thin answer, and none for a rich one", () => {
    const first = startOrResume(newInterviewState(), ctxOf());
    const thin = advance(first.state, say("Mostly how to behave at work."), ctxOf());
    // a.teach expects nothing specific, so a short answer simply moves on without nagging.
    expect(thin.prompt.kind).toBe("question");

    // b.first_job expects a date; an answer without one earns a date follow-up.
    let turn = advance(thin.state, say("Lessons from the shop floor, and operations in general."), ctxOf());
    turn = advance(turn.state, say("No limits really, apart from client names."), ctxOf());
    expect(turn.prompt.questionKey).toBe("b.first_job");
    const answered = advance(turn.state, say("I started as a graduate trainee at a steel company in Pune."), ctxOf());
    expect(answered.prompt.kind).toBe("followup");
    expect(answered.prompt.text).toMatch(/when/i);
  });

  it("asks how a measure was defined when the expert mentions one, once per phrase", () => {
    let turn = startOrResume(newInterviewState(), ctxOf());
    turn = advance(turn.state, say("I want people to learn how we cut scrap by 18% through better planning, and why it mattered so much to customers."), ctxOf());
    expect(turn.prompt.kind).toBe("followup");
    expect(turn.prompt.text).toMatch(/defined/i);
    const answered = advance(turn.state, say("Scrap rate is scrapped units over total units, monthly; baseline 6%, result 4.9%."), ctxOf());
    expect(answered.prompt.kind).toBe("question");
    expect(answered.state.followUps).toHaveLength(0);
  });

  it("asks about sensitive details with click-through choices and reports the decision", () => {
    let turn = startOrResume(newInterviewState(), ctxOf());
    turn = advance(turn.state, say("Teach them how my manager Rajesh Kumar handled the confidential client dispute with courage and care."), ctxOf());
    expect(turn.prompt.kind).toBe("followup");
    expect(turn.prompt.options?.map((o) => o.id)).toEqual(["public", "anonymize", "private"]);
    const decided = advance(turn.state, { kind: "choice", optionId: "anonymize" }, ctxOf());
    expect(decided.effects[0]).toMatchObject({ type: "permission", permission: "anonymize" });
  });

  it("survives a save and resume on another day without repeating any question", () => {
    const roles = [role({ id: "r1" })];
    const ctx = ctxOf(roles);
    const answer = auto(LONG);
    const part1 = drive(newInterviewState(), ctx, answer, (t) => t.prompt.kind === "confirm_roles");
    const saved = JSON.parse(JSON.stringify(part1.state)) as InterviewState; // as stored in the database
    const resumed = startOrResume(saved, ctx);
    expect(resumed.prompt.id).toBe(saved.prompt!.id); // the same question is offered again, not a new one
    const part2 = drive(saved, ctx, answer, (t) => t.prompt.kind === "summary_check");
    const all = [...part1.asked, ...part2.asked.slice(1)];
    expect(new Set(all).size).toBe(all.length); // nothing asked twice across sessions
    expect(part2.last.prompt.kind).toBe("summary_check");
  });

  it("explores each job in turn and lets the expert choose the order", () => {
    const roles = [role({ id: "r1", title: "Trainee", sortOrder: 0 }), role({ id: "r2", title: "Plant Manager", sortOrder: 1 })];
    const ctx = ctxOf(roles);
    const toRoles = drive(newInterviewState(), ctx, auto(LONG), (t) => t.prompt.kind === "confirm_roles");
    let turn = advance(toRoles.last.state, { kind: "roles_confirmed" }, ctx);
    expect(turn.prompt.decision).toBe("next_role");
    expect(turn.prompt.options?.map((o) => o.id)).toContain("r2");
    turn = advance(turn.state, { kind: "choice", optionId: "r2" }, ctx);
    expect(turn.prompt.roleId).toBe("r2");
    expect(turn.state.activeRoleId).toBe("r2");
  });

  it("skips people-management questions when the expert did not lead people", () => {
    const roles = [role({ id: "r1" })];
    const ctx = ctxOf(roles);
    const run = drive(newInterviewState(), ctx, (t) => (t.prompt.kind === "choice" ? { kind: "choice", optionId: t.prompt.decision === "leads_people" ? "no" : (t.prompt.options?.find((o) => o.id === "next" || o.id === "no" || o.id === "r1")?.id ?? t.prompt.options![0].id) } : t.prompt.kind === "confirm_roles" ? { kind: "roles_confirmed" } : say(LONG)), (t) => t.prompt.kind === "summary_check");
    expect(run.asked.filter((key) => key.startsWith("j."))).toHaveLength(0);
    expect(progressOf(run.state).find((p) => p.phase === "J")?.status).not.toBe("upcoming");
  });

  it("honours skip, not-sure and revisit without re-asking in the same pass", () => {
    const ctx = ctxOf();
    let turn = startOrResume(newInterviewState(), ctx);
    turn = advance(turn.state, { kind: "skip" }, ctx);
    expect(turn.state.entries["a.teach@-"].status).toBe("skipped");
    expect(turn.prompt.questionKey).toBe("a.topics");
    turn = advance(turn.state, { kind: "unknown" }, ctx);
    expect(turn.state.entries["a.topics@-"].status).toBe("unknown");
    turn = advance(turn.state, { kind: "revisit" }, ctx);
    expect(turn.state.entries["a.limits@-"].status).toBe("revisit");
    expect(turn.prompt.questionKey).toBe("b.first_job");
  });

  it("offers to confirm what an upload already established instead of asking again", () => {
    const roles = [role({ id: "r1" })];
    const known: KnownFact[] = [{ id: "f9", category: "tool", roleId: "r1", statement: "Used SAP PP for production planning and Excel for capacity.", fromUpload: true, reviewStatus: "proposed" }];
    const ctx = ctxOf(roles, known);
    const run = drive(newInterviewState(), ctx, (t) => (t.prompt.kind === "choice" ? { kind: "choice", optionId: t.prompt.options![0].id } : t.prompt.kind === "confirm_roles" ? { kind: "roles_confirmed" } : say(LONG)), (t) => t.prompt.kind === "confirm_known");
    expect(run.last.prompt.knownFactId).toBe("f9");
    const accepted = advance(run.state, { kind: "choice", optionId: "accurate" }, ctx);
    expect(accepted.effects).toContainEqual({ type: "known", factId: "f9", accurate: true });
    expect(accepted.state.entries[entryKey("f.tools", "r1", null)].status).toBe("covered");
    // "needs a correction" asks the real question once.
    const corrected = advance(run.state, { kind: "choice", optionId: "correct" }, ctx);
    expect(corrected.prompt.questionKey).toBe("f.tools");
  });

  it("builds a recap that names what is done and what is open", () => {
    const roles = [role({ id: "r1" })];
    const ctx = ctxOf(roles);
    const run = drive(newInterviewState(), ctx, auto(LONG), (t) => t.prompt.phase === "F");
    const recap = buildRecap(run.state, ctx);
    expect(recap.line).toMatch(/Last time we covered/);
    expect(recap.options.map((o) => o.id)).toEqual(["continue", "choose"]);
  });

  it("lists open questions by priority, with the reason", () => {
    const roles = [role({ id: "r1" })];
    const ctx = ctxOf(roles);
    const run = drive(newInterviewState(), ctx, auto("Short."), (t) => t.prompt.phase === "F");
    const open = openQuestions(run.state, ctx, 10);
    expect(open.length).toBeGreaterThan(0);
    expect(open[0].priority).toBeGreaterThanOrEqual(open[open.length - 1].priority);
    expect(open.some((q) => /brief/.test(q.reason))).toBe(true);
  });

  it("reaches a summary check for a short, shallow interview in bounded turns", () => {
    const run = drive(newInterviewState(), ctxOf(), auto("Okay."), (t) => t.prompt.kind === "summary_check");
    expect(run.last.prompt.kind).toBe("summary_check");
    expect(getQuestion("c.walk")).toBeDefined();
  });
});

