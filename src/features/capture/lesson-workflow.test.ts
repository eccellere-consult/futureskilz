import { describe, expect, it } from "vitest";

import { allowedActions, transition } from "./lesson-workflow";

describe("lesson workflow", () => {
  it("takes a lesson through editor review, contributor approval and publication, in that order", () => {
    let status = "draft" as const as import("./lesson-workflow").LessonStatus;
    for (const [action, actor] of [["submit", "editor"], ["editor_approve", "editor"], ["contributor_approve", "contributor"], ["publish", "editor"]] as const) {
      const result = transition(status, action, actor);
      expect(result.ok, `${action} from ${status}`).toBe(true);
      if (result.ok) status = result.to;
    }
    expect(status).toBe("published");
  });

  it("does not let an editor stand in for the contributor, or the contributor publish", () => {
    expect(transition("awaiting_contributor", "contributor_approve", "editor").ok).toBe(false);
    expect(transition("approved", "publish", "contributor").ok).toBe(false);
  });

  it("does not skip a step", () => {
    expect(transition("draft", "publish", "admin").ok).toBe(false);
    expect(transition("in_review", "contributor_approve", "contributor").ok).toBe(false);
  });

  it("lets the contributor send a lesson back or withdraw it at any stage", () => {
    expect(transition("awaiting_contributor", "contributor_reject", "contributor")).toEqual({ ok: true, to: "draft" });
    expect(allowedActions("published", "contributor")).toEqual(["retire"]);
  });
});
