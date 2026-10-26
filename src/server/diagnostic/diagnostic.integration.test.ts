/** Needs a real MariaDB (see capture.integration.test.ts). Skipped unless CAPTURE_INTEGRATION=1. */
import { randomUUID } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const enabled = process.env.CAPTURE_INTEGRATION === "1";

describe.skipIf(!enabled)("the conversational diagnostic on an account", () => {
  it("saves answers, resumes them, overwrites on a retake, and feeds the learner snapshot", async () => {
    const { createDatabase } = await import("../db/client");
    const { ensureDatabaseSchema } = await import("../db/ensure-schema");
    const schema = await import("../db/schema");
    const { loadDiagnostic, saveDiagnostic } = await import("./service");
    const { LearnerRepository } = await import("../learning/learner-repository");

    await ensureDatabaseSchema();
    const db = createDatabase();
    const userId = randomUUID();
    await db.insert(schema.users).values({ id: userId, email: `diag-${userId.slice(0, 6)}@example.test`, displayName: "Diag Test" });

    expect(await loadDiagnostic(userId)).toEqual({ answers: [], completed: false });
    await saveDiagnostic(userId, [{ questionId: "think-recurring-problem", option: 2 }], false);
    expect(await loadDiagnostic(userId)).toMatchObject({ completed: false, answers: [{ questionId: "think-recurring-problem", option: 2 }] });

    const repository = new LearnerRepository(db);
    const snapshot = await repository.loadSnapshot(userId);
    const found = snapshot.diagnostic?.find((item) => item.skill === "problem-solving");
    expect(found).toMatchObject({ level: 3, kind: "reported-behaviour" });

    await saveDiagnostic(userId, [{ questionId: "think-recurring-problem", option: 3, outcome: 2 }, { questionId: "ai-recent-use", option: null }], true);
    const again = await loadDiagnostic(userId);
    expect(again.completed).toBe(true);
    expect(again.answers).toHaveLength(2);
    const retaken = (await repository.loadSnapshot(userId)).diagnostic ?? [];
    expect(retaken.find((item) => item.skill === "problem-solving")).toMatchObject({ level: 4, kind: "reported-behaviour-with-result" });
    expect(retaken.some((item) => item.skill === "ai-literacy")).toBe(false); // "not in this situation" adds no evidence
  });
});
