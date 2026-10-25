/**
 * Who may move a lesson to which status. A lesson is never published by one party alone: an editor reviews it, the
 * contributor approves it, and only then can it be published. Publishing also needs every lesson gate to pass.
 */
export type LessonStatus = "draft" | "in_review" | "awaiting_contributor" | "approved" | "published" | "retired";
export type LessonAction = "submit" | "editor_approve" | "request_changes" | "contributor_approve" | "contributor_reject" | "publish" | "retire";
export type Actor = "contributor" | "editor" | "admin";

type Transition = { from: LessonStatus[]; to: LessonStatus; actors: Actor[] };

const TRANSITIONS: Record<LessonAction, Transition> = {
  submit: { from: ["draft"], to: "in_review", actors: ["editor", "admin"] },
  editor_approve: { from: ["in_review"], to: "awaiting_contributor", actors: ["editor", "admin"] },
  request_changes: { from: ["in_review", "awaiting_contributor"], to: "draft", actors: ["editor", "admin", "contributor"] },
  contributor_approve: { from: ["awaiting_contributor"], to: "approved", actors: ["contributor"] },
  contributor_reject: { from: ["awaiting_contributor", "approved", "in_review"], to: "draft", actors: ["contributor"] },
  publish: { from: ["approved"], to: "published", actors: ["editor", "admin"] },
  retire: { from: ["draft", "in_review", "awaiting_contributor", "approved", "published"], to: "retired", actors: ["contributor", "editor", "admin"] },
};

export type TransitionResult = { ok: true; to: LessonStatus } | { ok: false; reason: string };

export function transition(status: LessonStatus, action: LessonAction, actor: Actor): TransitionResult {
  const rule = TRANSITIONS[action];
  if (!rule) return { ok: false, reason: "Unknown action." };
  if (!rule.actors.includes(actor)) return { ok: false, reason: `A ${actor} cannot ${action.replace(/_/g, " ")} a lesson.` };
  if (!rule.from.includes(status)) return { ok: false, reason: `A lesson that is ${status.replace(/_/g, " ")} cannot ${action.replace(/_/g, " ")}.` };
  return { ok: true, to: rule.to };
}

export function allowedActions(status: LessonStatus, actor: Actor): LessonAction[] {
  return (Object.keys(TRANSITIONS) as LessonAction[]).filter((action) => transition(status, action, actor).ok);
}
