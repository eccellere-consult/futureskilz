/** Needs a real MariaDB (see capture.integration.test.ts). Skipped unless CAPTURE_INTEGRATION=1. */
import { randomUUID } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const enabled = process.env.CAPTURE_INTEGRATION === "1";
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe.skipIf(!enabled)("Skill Shot studio", () => {
  it("designs a draft, blocks review until the checks pass, and publishes only an approved, clean Skill Shot to learners", async () => {
    const { createDatabase } = await import("../db/client");
    const { ensureDatabaseSchema } = await import("../db/ensure-schema");
    const schema = await import("../db/schema");
    const service = await import("./service");
    const { rootCauseSkillShot } = await import("../../features/skillshot/samples/root-cause");

    await ensureDatabaseSchema();
    const db = createDatabase();
    const editor = randomUUID();
    const learner = randomUUID();
    await db.insert(schema.users).values([{ id: editor, email: `ed-${editor.slice(0, 6)}@example.test`, displayName: "Editor" }, { id: learner, email: `ln-${learner.slice(0, 6)}@example.test`, displayName: "Learner" }]);
    await db.insert(schema.userRoles).values({ userId: editor, role: "editor" });

    const brief = { topic: `Find the cause ${randomUUID().slice(0, 6)}`, skills: [{ skill: "problem-solving", toLevel: 2.5 }], audience: "Team leads who fix repeat problems", proficiency: "foundational", sourceKind: "illustrative", contributor: "Test coach", sourceNotes: "" };
    await expect(service.designSkillShot(learner, brief)).rejects.toThrow(/Only an editor/);
    await expect(service.designSkillShot(editor, { ...brief, skills: [{ skill: "nope", toLevel: 1 }] })).rejects.toThrow(/Check the brief/);

    const started = await service.designSkillShot(editor, brief);
    expect(["designing", "draft"]).toContain(started.status);
    let draft = started;
    for (let i = 0; i < 20 && draft.status === "designing"; i += 1) {
      await sleep(250);
      draft = await service.getDraft(editor, started.id);
    }
    expect(draft.status).toBe("draft");
    expect(draft.source).toBe("scaffold"); // no AI in the test environment: the structure with placeholders
    expect(draft.passes).toBe(false);

    await expect(service.draftAction(editor, draft.id, "submit")).rejects.toThrow(/still have/);
    await expect(service.getDraft(learner, draft.id)).rejects.toThrow(/Only an editor/);

    const written = structuredClone(rootCauseSkillShot);
    const saved = await service.saveBlueprint(editor, draft.id, written);
    expect(saved.passes).toBe(true);
    expect(saved.blueprint.meta.id).toBe(draft.slug);

    expect(await service.getPublishedBlueprint(draft.slug)).toBeNull();
    await expect(service.draftAction(editor, draft.id, "publish")).rejects.toThrow(/cannot/);
    await service.draftAction(editor, draft.id, "submit");
    await service.draftAction(editor, draft.id, "approve");
    const published = await service.draftAction(editor, draft.id, "publish");
    expect(published.status).toBe("published");
    expect((await service.getPublishedBlueprint(draft.slug))?.meta.reviewStatus).toBe("published");
    expect((await service.listPublishedBlueprints()).some((item) => item.meta.id === draft.slug)).toBe(true);
    await expect(service.saveBlueprint(editor, draft.id, written)).rejects.toThrow(/not edited in place/);
  });
});
