/** Needs a real MariaDB (see capture.integration.test.ts). Skipped unless CAPTURE_INTEGRATION=1. */
import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const enabled = process.env.CAPTURE_INTEGRATION === "1";

describe.skipIf(!enabled)("Skill Passport and share links", () => {
  it("builds from the same estimates, shares only what the owner chose, and stops when revoked or expired", async () => {
    const { createDatabase } = await import("../db/client");
    const { ensureDatabaseSchema } = await import("../db/ensure-schema");
    const schema = await import("../db/schema");
    const { LearnerRepository } = await import("../learning/learner-repository");
    const { saveDiagnostic } = await import("../diagnostic/service");
    const { saveTargetRole } = await import("../pathway/target-role");
    const passportService = await import("./service");
    const { resetLimits } = await import("../coach/service");
    const { rootCauseSkillShot } = await import("../../features/skillshot/samples/root-cause");

    await ensureDatabaseSchema();
    resetLimits();
    const db = createDatabase();
    const userId = randomUUID();
    await db.insert(schema.users).values({ id: userId, email: `pp-${userId.slice(0, 6)}@example.test`, displayName: "Priya Nair" });
    const repository = new LearnerRepository(db);
    await repository.saveDraft(userId, { name: "Priya Nair", currentRole: "Production Planner", responsibilityLevel: "individual", focus: "career", horizon: "6-months", priorityFamilies: [], prioritySkills: [], challengeType: "", challenge: "A private worry about my manager.", goal: "A private goal I would not share.", weeklyMinutes: 60 });
    await repository.saveAssessment(userId, { "digital-fluency": 1, "critical-thinking": 2, creativity: 1, "human-skills": 2, "adaptive-leadership": 1 });
    await saveDiagnostic(userId, [{ questionId: "think-recurring-problem", option: 3, outcome: 2 }], true);
    await repository.completeDesignedSkillShot(userId, rootCauseSkillShot.meta.id, rootCauseSkillShot.meta.skillMap);
    await saveTargetRole(userId, "operations-manager");

    const passport = await passportService.buildPassport(userId);
    expect(passport).toMatchObject({ name: "Priya Nair", currentRole: "Production Planner", targetRole: "Operations Manager" });
    const ps = passport.skills.find((skill) => skill.skill === "problem-solving")!;
    expect(ps.level).toBeGreaterThan(3);
    expect(passport.skills.every((skill) => skill.source !== "none" && skill.source !== "inferred" && skill.confidence <= 1)).toBe(true);
    expect(passport.basis.inferredNotListed).toBeGreaterThan(0);
    expect(passport.evidence.map((item) => item.title)).toContain(rootCauseSkillShot.meta.title);
    expect(passport.evidence.some((item) => item.kind === "conversation")).toBe(true);
    // Private writing is nowhere in it.
    expect(JSON.stringify(passport)).not.toMatch(/private|worry|manager\./i);

    // A link: the default shows no name, the secret is stored only as a hash, and a wrong link shows nothing.
    const made = await passportService.createShare(userId, { label: "For a recruiter", days: 7 });
    expect(made.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const [stored] = await db.select().from(schema.passportShares).where(eq(schema.passportShares.id, made.id));
    expect(stored.tokenHash).not.toContain(made.token);
    expect(JSON.stringify(stored)).not.toContain(made.token);
    const shown = await passportService.resolveShare(made.token, "5.5.5.5");
    expect(shown?.passport.name).toBe("A FutureSkilz learner");
    expect(shown?.passport.currentRole).toBe("");
    expect(JSON.stringify(shown?.passport)).not.toContain("Priya");
    expect(shown?.passport.skills.length).toBe(passport.skills.length);
    expect(await passportService.resolveShare("x".repeat(43), "5.5.5.5")).toBeNull();
    expect(await passportService.resolveShare("short", "5.5.5.5")).toBeNull();

    const listed = await passportService.listShares(userId);
    expect(listed[0]).toMatchObject({ label: "For a recruiter", views: 1, active: true });
    expect(JSON.stringify(listed)).not.toContain(made.token);

    // The owner may choose to show more.
    const open = await passportService.createShare(userId, { include: { name: true, targetRole: true, evidence: true } });
    expect((await passportService.resolveShare(open.token, "5.5.5.5"))?.passport.name).toBe("Priya Nair");

    // Revoked and expired links stop working at once.
    await passportService.revokeShare(userId, made.id);
    expect(await passportService.resolveShare(made.token, "5.5.5.5")).toBeNull();
    await db.update(schema.passportShares).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(schema.passportShares.id, open.id));
    expect(await passportService.resolveShare(open.token, "5.5.5.5")).toBeNull();

    // Another person cannot revoke it, and the active count is capped.
    const other = randomUUID();
    await db.insert(schema.users).values({ id: other, email: `po-${other.slice(0, 6)}@example.test`, displayName: "Other" });
    const keep = await passportService.createShare(userId, {});
    await passportService.revokeShare(other, keep.id);
    expect(await passportService.resolveShare(keep.token, "5.5.5.5")).not.toBeNull();
    for (let i = 0; i < 9; i += 1) await passportService.createShare(userId, {});
    await expect(passportService.createShare(userId, {})).rejects.toThrow(/ten active links/);
  });
});
