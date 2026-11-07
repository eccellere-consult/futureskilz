/** Needs a real MariaDB (see capture.integration.test.ts). Skipped unless CAPTURE_INTEGRATION=1. */
import { randomUUID } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const enabled = process.env.CAPTURE_INTEGRATION === "1";

describe.skipIf(!enabled)("evidence from a designed Skill Shot", () => {
  it("records one piece of evidence per skill once, caps it at what the lesson teaches, and shows it in the snapshot", async () => {
    const { createDatabase } = await import("../db/client");
    const { ensureDatabaseSchema } = await import("../db/ensure-schema");
    const schema = await import("../db/schema");
    const { LearnerRepository } = await import("./learner-repository");
    const { rootCauseSkillShot } = await import("../../features/skillshot/samples/root-cause");

    await ensureDatabaseSchema();
    const db = createDatabase();
    const userId = randomUUID();
    await db.insert(schema.users).values({ id: userId, email: `designed-${userId.slice(0, 6)}@example.test`, displayName: "Designed Test" });

    const repository = new LearnerRepository(db);
    const map = rootCauseSkillShot.meta.skillMap;
    const first = await repository.completeDesignedSkillShot(userId, rootCauseSkillShot.meta.id, map);
    expect(first.evidenceAdded).toBe(true);
    expect(first.skills.sort()).toEqual(map.map((item) => item.skill).sort());

    const again = await repository.completeDesignedSkillShot(userId, rootCauseSkillShot.meta.id, map);
    expect(again).toEqual({ evidenceAdded: false, skills: [] });

    const snapshot = await repository.loadSnapshot(userId);
    expect(snapshot.completedDesigned).toEqual([rootCauseSkillShot.meta.id]);
    const levels = new Map((snapshot.skillLevels ?? []).map((row) => [row.skill, row]));
    for (const { skill, toLevel } of map) {
      const row = levels.get(skill)!;
      expect(row.evidenceCount).toBe(1);
      expect(row.level).toBeGreaterThan(0);
      expect(row.level).toBeLessThanOrEqual(toLevel);
    }
  });
});
