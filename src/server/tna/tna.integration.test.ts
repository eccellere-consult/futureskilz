/**
 * Training-needs flow against a real MariaDB, with the plain (no-AI) provider so it needs no key: a coach plans a training,
 * the needs and tree are proposed, edited, checked and approved, and the Skill Shot briefs come out. Skipped unless
 * CAPTURE_INTEGRATION=1 (see capture.integration.test.ts). Run it with `npm run test:integration`.
 */
import { randomUUID } from "node:crypto";

import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/server/providers", async () => {
  const { DeterministicAiProvider } = await import("@/server/providers/ai");
  return { createProviders: () => ({ ai: new DeterministicAiProvider() }) };
});

const enabled = process.env.CAPTURE_INTEGRATION === "1";

describe.skipIf(!enabled)("training needs, end to end", () => {
  let coach = "";
  let editor = "";
  let stranger = "";
  let svc: typeof import("./service");

  async function settled(userId: string, id: string) {
    for (let i = 0; i < 50; i += 1) {
      const program = await svc.getProgram(userId, id);
      if (!program.working) return program;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error("The step did not finish.");
  }

  beforeAll(async () => {
    svc = await import("./service");
    const shared = await import("@/server/capture/shared");
    const schema = await import("@/server/db/schema");
    const db = await shared.database();
    const make = async (name: string, roles: string[]) => {
      const id = randomUUID();
      await db.insert(schema.users).values({ id, email: `${name}-${id.slice(0, 6)}@example.test`, displayName: name });
      for (const role of roles) await db.insert(schema.userRoles).values({ userId: id, role });
      return id;
    };
    coach = await make("Cora Coach", ["contributor"]);
    editor = await make("Edith Editor", ["editor"]);
    stranger = await make("Sam Stranger", []);
  });

  it("takes a coach from a brief to approved briefs, and keeps others out", async () => {
    await expect(svc.createProgram(stranger, { topic: "Lean basics", audience: { role: "Supervisors", level: "foundational" }, goal: "Less rework" })).rejects.toMatchObject({ status: 403 });
    await expect(svc.createProgram(coach, { topic: "x" })).rejects.toMatchObject({ status: 400 });

    const { id } = await svc.createProgram(coach, { topic: "Lean basics for line supervisors", audience: { role: "Line supervisors", level: "foundational" }, goal: "Fewer rework loops on the line." });
    await expect(svc.getProgram(stranger, id)).rejects.toMatchObject({ status: 403 });
    await expect(svc.startStep(coach, id, "tree")).rejects.toMatchObject({ status: 400 });

    await svc.startStep(coach, id, "needs");
    const withNeeds = await settled(coach, id);
    expect(withNeeds.source).toBe("scaffold");
    expect(withNeeds.needs.length).toBeGreaterThanOrEqual(3);

    await svc.saveNeeds(coach, id, withNeeds.needs.map((need) => ({ ...need, status: "confirmed" })));
    await svc.startStep(coach, id, "tree");
    const withTree = await settled(coach, id);
    expect(withTree.nodes.length).toBeGreaterThan(5);
    expect(withTree.check.leafCount).toBe(6);

    await expect(svc.briefsFor(coach, id)).rejects.toMatchObject({ status: 409 });
    const leaf = withTree.nodes.find((node) => !withTree.nodes.some((other) => other.parentId === node.id))!;
    await svc.editTree(coach, id, { action: "update", id: leaf.id, fields: { skills: ["not-a-skill"] } }).then(
      () => expect.unreachable(),
      (error) => expect(error).toMatchObject({ status: 400 }),
    );
    await svc.editTree(coach, id, { action: "update", id: leaf.id, fields: { title: "A renamed first piece", minutes: 9 } });

    await svc.approveProgram(editor, id);
    const approved = await svc.getProgram(coach, id);
    expect(approved.status).toBe("approved");
    const briefs = await svc.briefsFor(coach, id);
    expect(briefs).toHaveLength(6);
    expect(briefs.some((brief) => brief.topic === "A renamed first piece")).toBe(true);

    // Editing after approval puts the plan back to draft.
    await svc.editTree(coach, id, { action: "add", parentId: null, title: "An extra module" });
    expect((await svc.getProgram(coach, id)).status).toBe("draft");

    await svc.deleteProgram(coach, id);
    await expect(svc.getProgram(coach, id)).rejects.toMatchObject({ status: 404 });
  });
});
