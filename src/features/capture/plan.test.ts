import { describe, expect, it } from "vitest";

import { role } from "./fixtures";
import { ARYA_PLAN, OPTIONAL_PHASES, planFromSelection, planMinutes, readPlan } from "./plan";
import { advance, applyPlan, newInterviewState, progressOf, startOrResume, type TurnInput } from "./planner";
import { QUESTION_BANK } from "./question-bank";
import { entryKey, type InterviewState, type PlannerContext } from "./types";

const ctx: PlannerContext = { roles: [role({ id: "r1", title: "Planner", company: "Acme" })], known: [], now: "2026-10-25T10:00:00.000Z" };
let n = 0;
const LONG = "We used SAP. First we checked demand, then scheduled the lines, then released orders. For example, once we cut changeover by 20 percent and late orders fell.";

function run(state: InterviewState): string[] {
  let turn = startOrResume(state, ctx);
  const asked: string[] = [];
  for (let i = 0; i < 700 && turn.prompt.kind !== "closing"; i += 1) {
    const p = turn.prompt;
    if (p.questionKey) asked.push(entryKey(p.questionKey, p.roleId ?? null, p.processId ?? null));
    const input: TurnInput =
      p.kind === "confirm_roles" ? { kind: "roles_confirmed" } : p.kind === "choice" || p.kind === "summary_check" ? { kind: "choice", optionId: p.options![0].id } : { kind: "answer", text: LONG, segmentId: `s${++n}` };
    turn = advance(turn.state, input, ctx);
  }
  return asked;
}

describe("interview plan", () => {
  it("Arya's own plan leaves nothing out and does not change the interview", () => {
    expect(ARYA_PLAN.skipPhases).toEqual([]);
    expect(planFromSelection("arya", [], ["ignored"]).topics).toEqual([]);
  });

  it("never lets the expert drop the required parts, and ignores unknown input", () => {
    const plan = readPlan({ mode: "edit", skipPhases: ["A", "O", "G", "ZZ"], topics: [" Shop-floor safety ", "", 42] });
    expect(plan?.skipPhases).toEqual(["G"]);
    expect(plan?.topics).toEqual(["Shop-floor safety"]);
    expect(readPlan({ mode: "hacker" })).toBeNull();
    expect(readPlan("x")).toBeNull();
  });

  it("builds an own-structure plan from just the parts the expert picked", () => {
    const plan = planFromSelection("self", ["G", "K"], []);
    expect(plan.skipPhases).toEqual(OPTIONAL_PHASES.filter((phase) => phase !== "G" && phase !== "K"));
    expect(planMinutes(plan.skipPhases)).toBeLessThan(planMinutes([]));
  });

  it("never asks the questions of a part that was left out, and marks it not applicable", () => {
    const full = run(applyPlan(newInterviewState(), ARYA_PLAN));
    const plan = planFromSelection("edit", OPTIONAL_PHASES.filter((phase) => phase !== "G" && phase !== "J" && phase !== "N"), []);
    const trimmed = run(applyPlan(newInterviewState(), plan));
    const phaseOf = (key: string) => QUESTION_BANK.find((question) => question.key === key.split("@")[0])?.phase;
    expect(full.some((key) => phaseOf(key) === "G")).toBe(true);
    expect(trimmed.some((key) => ["G", "J", "N"].includes(phaseOf(key) ?? ""))).toBe(false);
    expect(trimmed.length).toBeLessThan(full.length);
    expect(trimmed.some((key) => phaseOf(key) === "O")).toBe(true);
    const state = applyPlan({ ...newInterviewState(), activeRoleId: "r1" }, plan);
    expect(progressOf(state).find((item) => item.phase === "G")?.status).toBe("not_applicable");
  });

  it("treats topics the expert names as focus, and keeps older checkpoints working", () => {
    const state = applyPlan(newInterviewState(), planFromSelection("self", ["G"], ["Supplier negotiation tactics"]));
    expect(state.focusTerms).toContain("supplier");
    expect(state.plan?.mode).toBe("self");
    expect(newInterviewState().plan).toBeUndefined();
    expect(run(newInterviewState()).length).toBeGreaterThan(10);
  });
});
