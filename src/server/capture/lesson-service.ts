import "server-only";

import { and, desc, eq, inArray, ne } from "drizzle-orm";

import { evaluateLessonGates, type Gate } from "@/features/capture/gates";
import { buildKnowledgePackage, publishableText } from "@/features/capture/knowledge-package";
import { allowedActions, transition, type Actor, type LessonAction, type LessonStatus } from "@/features/capture/lesson-workflow";
import { blueprintLessons, buildLearningPaths, checkLesson, type LearningPath, type LessonSpec } from "@/features/capture/lessons";
import { cleanSkillMap, suggestSkills, type LessonSkillMap } from "@/features/pathway/skill-map";
import { kcContributors, kcDocuments, kcLessonAttribution, kcLessons, kcProjects } from "@/server/db/schema";

import { currentConsents } from "./interview-service";
import { fingerprintOf } from "./review-service";
import { CaptureError, audit, database, iso, loadFacts, loadRoles, loadSegmentsById, newUuid, rolesOf, type Executor } from "./shared";

type LessonRow = typeof kcLessons.$inferSelect;
type SpecWithBase = LessonSpec & { baseSlug?: string; skillMap?: LessonSkillMap };

const specOf = (row: LessonRow): SpecWithBase => row.spec as unknown as SpecWithBase;

async function sourceTexts(executor: Executor, projectId: string, factIds: string[]): Promise<string[]> {
  const facts = await loadFacts(executor, projectId);
  return facts.filter((fact) => factIds.includes(fact.id)).map((fact) => publishableText(fact) ?? "");
}

/** Editors and admins turn an approved package into lesson drafts. The contributor's confirmed words are the only source. */
export async function generateLessons(actorId: string, projectId: string): Promise<{ created: number; updated: number; unchanged: number; skipped: Array<{ topic: string; reason: string }> }> {
  const db = await database();
  const roles = await rolesOf(db, actorId);
  if (!roles.has("editor") && !roles.has("admin")) throw new CaptureError(403, "Only an editor can create lessons.");
  return db.transaction(async (tx) => {
    const [project] = await tx.select().from(kcProjects).where(eq(kcProjects.id, projectId)).for("update");
    if (!project) throw new CaptureError(404, "That interview was not found.");
    if (project.status !== "approved" && project.status !== "published") throw new CaptureError(409, "The contributor has not approved this knowledge package yet.");
    const [approved] = await tx.select().from(kcDocuments).where(and(eq(kcDocuments.projectId, projectId), eq(kcDocuments.kind, "skill_md"), eq(kcDocuments.status, "approved"))).orderBy(desc(kcDocuments.version)).limit(1);
    if (!approved) throw new CaptureError(409, "There is no approved version to build lessons from.");

    const facts = await loadFacts(tx, projectId);
    if (fingerprintOf(facts) !== approved.factFingerprint) throw new CaptureError(409, "The contributor changed statements after approving. Ask them to approve the package again.");

    const careerRoles = await loadRoles(tx, projectId);
    const segmentIds = Array.from(new Set(facts.flatMap((fact) => fact.sources.map((source) => source.segmentId))));
    const segments = await loadSegmentsById(tx, segmentIds);
    const pkg = buildKnowledgePackage({ facts, segments, mode: "publish" });
    const [contributor] = await tx.select().from(kcContributors).where(eq(kcContributors.userId, project.contributorId));
    const { lessons, skipped } = blueprintLessons(pkg, { contributor: contributor?.publicName ?? "The contributor", roles: careerRoles, now: new Date().toISOString() });
    const allText = pkg.sections.flatMap((section) => section.items).map((item) => item.text);

    let created = 0;
    let updated = 0;
    let unchanged = 0;
    for (const lesson of lessons) {
      const issues = checkLesson(lesson, allText);
      const baseSlug = lesson.slug;
      const rows = await tx.select().from(kcLessons).where(eq(kcLessons.projectId, projectId));
      const existing = rows.filter((row) => specOf(row).baseSlug === baseSlug || row.slug === baseSlug).sort((a, b) => b.version - a.version)[0];
      const sameContent = (row: LessonRow) => JSON.stringify(specOf(row).narration) === JSON.stringify(lesson.narration) && JSON.stringify(row.factIds) === JSON.stringify(lesson.factIds);

      if (existing && sameContent(existing)) {
        unchanged += 1;
        continue;
      }
      // A rewritten lesson keeps its earlier skills as suggestions to re-confirm; a new one gets rule-based suggestions.
      const skillMap: LessonSkillMap = existing?.spec && specOf(existing).skillMap
        ? { status: "suggested", skills: specOf(existing).skillMap!.skills }
        : { status: "suggested", skills: suggestSkills(lesson).map(({ skill, toLevel }) => ({ skill, toLevel })) };
      const spec: SpecWithBase = { ...lesson, baseSlug, skillMap };
      if (existing && ["draft", "in_review", "awaiting_contributor"].includes(existing.status)) {
        await tx.update(kcLessons).set({ spec: spec as unknown as Record<string, unknown>, factIds: lesson.factIds, issues, title: lesson.title, durationSeconds: lesson.durationSeconds, status: "draft", editorApprovedAt: null, editorApprovedBy: null, contributorApprovedAt: null }).where(eq(kcLessons.id, existing.id));
        await audit(tx, actorId, "lesson.regenerate", "lesson", existing.id);
        updated += 1;
        continue;
      }
      // First lesson, or a published/approved one whose source changed: a new version, so what learners saw is never rewritten.
      const version = existing ? existing.version + 1 : 1;
      const id = newUuid();
      await tx.insert(kcLessons).values({
        id,
        slug: existing ? `${baseSlug}-v${version}` : baseSlug,
        projectId,
        contributorId: project.contributorId,
        version,
        status: "draft",
        title: lesson.title,
        stage: lesson.stage,
        proficiency: lesson.proficiency,
        roleLabel: lesson.roleLabel,
        industry: lesson.industry,
        durationSeconds: lesson.durationSeconds,
        spec: spec as unknown as Record<string, unknown>,
        factIds: lesson.factIds,
        issues,
      });
      // Credit is set when the lesson is created, so usage is attributable from the first view.
      await tx.insert(kcLessonAttribution).values({ lessonId: id, contributorId: project.contributorId, shareBp: 10000, creditedAs: "author" });
      await audit(tx, actorId, "lesson.create", "lesson", id, { version });
      created += 1;
    }
    return { created, updated, unchanged, skipped };
  });
}

export type LessonSummary = {
  id: string;
  slug: string;
  title: string;
  status: LessonStatus;
  stage: string;
  proficiency: string;
  roleLabel: string;
  durationSeconds: number;
  version: number;
  projectId: string;
  contributorId: string;
  issues: Array<{ id: string; message: string }>;
  editorApproved: boolean;
  contributorApproved: boolean;
  publishedAt: string | null;
  actions: LessonAction[];
};

async function actorFor(executor: Executor, userId: string, row: LessonRow): Promise<Actor | null> {
  const roles = await rolesOf(executor, userId);
  if (roles.has("admin")) return "admin";
  if (roles.has("editor")) return "editor";
  if (row.contributorId === userId) return "contributor";
  const [credited] = await executor.select().from(kcLessonAttribution).where(and(eq(kcLessonAttribution.lessonId, row.id), eq(kcLessonAttribution.contributorId, userId)));
  return credited ? "contributor" : null;
}

function summarise(row: LessonRow, actor: Actor | null): LessonSummary {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    status: row.status,
    stage: row.stage,
    proficiency: row.proficiency,
    roleLabel: row.roleLabel,
    durationSeconds: row.durationSeconds,
    version: row.version,
    projectId: row.projectId,
    contributorId: row.contributorId,
    issues: row.issues ?? [],
    editorApproved: !!row.editorApprovedAt,
    contributorApproved: !!row.contributorApprovedAt,
    publishedAt: row.publishedAt ? iso(row.publishedAt) : null,
    actions: actor ? allowedActions(row.status, actor) : [],
  };
}

export async function listLessonsForUser(userId: string, filter: { projectId?: string } = {}): Promise<LessonSummary[]> {
  const db = await database();
  const roles = await rolesOf(db, userId);
  const staff = roles.has("editor") || roles.has("admin");
  const rows = await db.select().from(kcLessons).orderBy(desc(kcLessons.updatedAt));
  const credited = await db.select().from(kcLessonAttribution).where(eq(kcLessonAttribution.contributorId, userId));
  const creditedIds = new Set(credited.map((row) => row.lessonId));
  const visible = rows.filter((row) => (staff || row.contributorId === userId || creditedIds.has(row.id)) && (!filter.projectId || row.projectId === filter.projectId));
  return visible.map((row) => summarise(row, staff ? (roles.has("admin") ? "admin" : "editor") : "contributor"));
}

export type LessonDetail = {
  summary: LessonSummary;
  spec: LessonSpec;
  gates: Gate[];
  attribution: Array<{ contributorId: string; name: string; shareBp: number; creditedAs: string }>;
};

export async function getLessonDetail(userId: string, lessonId: string): Promise<LessonDetail> {
  const db = await database();
  const [row] = await db.select().from(kcLessons).where(eq(kcLessons.id, lessonId));
  if (!row) throw new CaptureError(404, "That lesson was not found.");
  const actor = await actorFor(db, userId, row);
  if (!actor) throw new CaptureError(404, "That lesson was not found.");
  return { summary: summarise(row, actor), spec: specOf(row), gates: await gatesFor(db, row), attribution: await attributionOf(db, lessonId) };
}

async function attributionOf(executor: Executor, lessonId: string) {
  const rows = await executor.select().from(kcLessonAttribution).where(eq(kcLessonAttribution.lessonId, lessonId));
  const names = rows.length ? await executor.select().from(kcContributors).where(inArray(kcContributors.userId, rows.map((row) => row.contributorId))) : [];
  return rows.map((row) => ({ contributorId: row.contributorId, name: names.find((n) => n.userId === row.contributorId)?.publicName ?? "Contributor", shareBp: row.shareBp, creditedAs: row.creditedAs }));
}

async function gatesFor(executor: Executor, row: LessonRow): Promise<Gate[]> {
  const spec = specOf(row);
  const [approved] = await executor.select().from(kcDocuments).where(and(eq(kcDocuments.projectId, row.projectId), eq(kcDocuments.kind, "skill_md"), eq(kcDocuments.status, "approved"))).orderBy(desc(kcDocuments.version)).limit(1);
  const facts = await loadFacts(executor, row.projectId);
  const used = facts.filter((fact) => row.factIds.includes(fact.id));
  const publishable = used.length === row.factIds.length && used.every((fact) => (fact.reviewStatus === "confirmed" || fact.reviewStatus === "corrected") && publishableText(fact) !== null);
  const attribution = await executor.select().from(kcLessonAttribution).where(eq(kcLessonAttribution.lessonId, row.id));
  const consents = await currentConsents(executor, row.contributorId);
  const texts = used.map((fact) => publishableText(fact) ?? "");
  return evaluateLessonGates({
    packageApproved: !!approved && approved.factFingerprint === fingerprintOf(facts),
    consents,
    usesSyntheticVoice: false,
    issues: checkLesson(spec, texts),
    hasCaptions: spec.scenes.length > 0 && spec.scenes.every((scene) => !!spec.narration[scene.narrationIndex]),
    editorApproved: !!row.editorApprovedAt,
    contributorApproved: !!row.contributorApprovedAt,
    attributionBasisPoints: attribution.reduce((sum, item) => sum + item.shareBp, 0),
    contributorCount: attribution.length,
    factsPublishable: publishable,
  });
}

export async function lessonAction(userId: string, lessonId: string, action: LessonAction, note?: string): Promise<LessonSummary> {
  const db = await database();
  return db.transaction(async (tx) => {
    const [row] = await tx.select().from(kcLessons).where(eq(kcLessons.id, lessonId)).for("update");
    if (!row) throw new CaptureError(404, "That lesson was not found.");
    const actor = await actorFor(tx, userId, row);
    if (!actor) throw new CaptureError(404, "That lesson was not found.");
    const result = transition(row.status, action, actor);
    if (!result.ok) throw new CaptureError(409, result.reason);

    const patch: Partial<typeof kcLessons.$inferInsert> = { status: result.to };
    if (action === "editor_approve") {
      const issues = checkLesson(specOf(row), await sourceTexts(tx, row.projectId, row.factIds));
      if (issues.length) throw new CaptureError(422, `Fix these first: ${issues.map((issue) => issue.message).join(" ")}`);
      patch.editorApprovedAt = new Date();
      patch.editorApprovedBy = userId;
    }
    if (action === "contributor_approve") patch.contributorApprovedAt = new Date();
    if (action === "request_changes" || action === "contributor_reject" || action === "submit") {
      patch.editorApprovedAt = null;
      patch.editorApprovedBy = null;
      patch.contributorApprovedAt = null;
    }
    if (action === "publish") {
      const gates = await gatesFor(tx, row);
      const failing = gates.filter((gate) => gate.blocking && !gate.passed);
      if (failing.length) throw new CaptureError(422, `Not ready to publish: ${failing.map((gate) => `${gate.label} — ${gate.detail}`).join(" ")}`, { gates });
      patch.publishedAt = new Date();
      // A new version replaces the older published ones of the same lesson.
      const base = specOf(row).baseSlug ?? row.slug;
      const siblings = await tx.select().from(kcLessons).where(and(eq(kcLessons.projectId, row.projectId), eq(kcLessons.status, "published"), ne(kcLessons.id, row.id)));
      for (const sibling of siblings.filter((item) => (specOf(item).baseSlug ?? item.slug) === base)) await tx.update(kcLessons).set({ status: "retired" }).where(eq(kcLessons.id, sibling.id));
      await tx.update(kcProjects).set({ status: "published" }).where(eq(kcProjects.id, row.projectId));
    }
    await tx.update(kcLessons).set(patch).where(eq(kcLessons.id, lessonId));
    await audit(tx, userId, `lesson.${action}`, "lesson", lessonId, { from: row.status, to: result.to, note: note?.slice(0, 400) });
    const [fresh] = await tx.select().from(kcLessons).where(eq(kcLessons.id, lessonId));
    return summarise(fresh, actor);
  });
}

export type LessonEdit = { title?: string; objective?: string; narration?: string[] };

/** An editor adjusts wording. The mechanical checks run again, and every approval is cleared. */
export async function editLesson(userId: string, lessonId: string, edit: LessonEdit): Promise<LessonDetail> {
  const db = await database();
  await db.transaction(async (tx) => {
    const roles = await rolesOf(tx, userId);
    if (!roles.has("editor") && !roles.has("admin")) throw new CaptureError(403, "Only an editor can edit a lesson.");
    const [row] = await tx.select().from(kcLessons).where(eq(kcLessons.id, lessonId)).for("update");
    if (!row) throw new CaptureError(404, "That lesson was not found.");
    if (row.status === "published" || row.status === "retired") throw new CaptureError(409, "A published lesson is not edited in place. Regenerate it to draft a new version.");
    const spec = { ...specOf(row) };
    if (edit.title) spec.title = edit.title.trim().slice(0, 240);
    if (edit.objective) spec.objective = edit.objective.trim().slice(0, 400);
    if (edit.narration) {
      if (edit.narration.length !== spec.narration.length) throw new CaptureError(400, "Keep the same number of narration paragraphs; each belongs to a scene.");
      spec.narration = edit.narration.map((paragraph) => paragraph.trim().slice(0, 1200));
    }
    const issues = checkLesson(spec, await sourceTexts(tx, row.projectId, row.factIds));
    await tx.update(kcLessons).set({ spec: spec as unknown as Record<string, unknown>, title: spec.title, issues, status: "draft", editorApprovedAt: null, editorApprovedBy: null, contributorApprovedAt: null }).where(eq(kcLessons.id, lessonId));
    await audit(tx, userId, "lesson.edit", "lesson", lessonId);
  });
  return getLessonDetail(userId, lessonId);
}

/** An editor confirms which Skill Graph capabilities a lesson builds. It is metadata, so wording approvals stay as they are. */
export async function setLessonSkills(userId: string, lessonId: string, skills: unknown): Promise<LessonDetail> {
  const db = await database();
  const cleaned = cleanSkillMap(skills);
  if (cleaned.length === 0) throw new CaptureError(400, "Choose at least one skill this lesson builds.");
  await db.transaction(async (tx) => {
    const roles = await rolesOf(tx, userId);
    if (!roles.has("editor") && !roles.has("admin")) throw new CaptureError(403, "Only an editor can confirm the skills a lesson builds.");
    const [row] = await tx.select().from(kcLessons).where(eq(kcLessons.id, lessonId)).for("update");
    if (!row) throw new CaptureError(404, "That lesson was not found.");
    const spec: SpecWithBase = { ...specOf(row), skillMap: { status: "confirmed", skills: cleaned, confirmedAt: new Date().toISOString() } };
    await tx.update(kcLessons).set({ spec: spec as unknown as Record<string, unknown> }).where(eq(kcLessons.id, lessonId));
    await audit(tx, userId, "lesson.skills", "lesson", lessonId, { skills: cleaned.map((item) => item.skill) });
  });
  return getLessonDetail(userId, lessonId);
}

/** Who is credited, in basis points that add up to 10000. Changing it after publication is an admin decision and is audited. */
export async function setAttribution(userId: string, lessonId: string, shares: Array<{ contributorId: string; shareBp: number; creditedAs?: string }>): Promise<LessonDetail["attribution"]> {
  const db = await database();
  await db.transaction(async (tx) => {
    const roles = await rolesOf(tx, userId);
    if (!roles.has("editor") && !roles.has("admin")) throw new CaptureError(403, "Only an editor can change attribution.");
    const [row] = await tx.select().from(kcLessons).where(eq(kcLessons.id, lessonId)).for("update");
    if (!row) throw new CaptureError(404, "That lesson was not found.");
    if ((row.status === "published" || row.status === "approved") && !roles.has("admin")) throw new CaptureError(403, "Only an admin can change who is credited once a lesson is approved.");
    if (shares.length === 0 || shares.some((share) => !Number.isInteger(share.shareBp) || share.shareBp <= 0)) throw new CaptureError(400, "Each contributor needs a positive share in basis points.");
    if (new Set(shares.map((share) => share.contributorId)).size !== shares.length) throw new CaptureError(400, "List each contributor once.");
    const total = shares.reduce((sum, share) => sum + share.shareBp, 0);
    if (total !== 10000) throw new CaptureError(400, `Shares must add up to 10000 (100%); they add up to ${total}.`);
    const known = await tx.select().from(kcContributors).where(inArray(kcContributors.userId, shares.map((share) => share.contributorId)));
    if (known.length !== shares.length) throw new CaptureError(404, "One of those contributors is not registered.");
    const before = await tx.select().from(kcLessonAttribution).where(eq(kcLessonAttribution.lessonId, lessonId));
    await tx.delete(kcLessonAttribution).where(eq(kcLessonAttribution.lessonId, lessonId));
    for (const share of shares) await tx.insert(kcLessonAttribution).values({ lessonId, contributorId: share.contributorId, shareBp: share.shareBp, creditedAs: (share.creditedAs ?? "author").slice(0, 24) });
    await audit(tx, userId, "lesson.attribution", "lesson", lessonId, { before: before.map((b) => ({ contributorId: b.contributorId, shareBp: b.shareBp })), after: shares });
  });
  return attributionOf(db, lessonId);
}

// ---------------------------------------------------------------------------------------------------------------------
// What learners see
// ---------------------------------------------------------------------------------------------------------------------

export type PublicLesson = {
  id: string;
  slug: string;
  title: string;
  version: number;
  spec: LessonSpec;
  credits: Array<{ name: string; creditedAs: string }>;
};

async function publicCredits(executor: Executor, lessonId: string) {
  const attribution = await attributionOf(executor, lessonId);
  return attribution.map((item) => ({ name: item.name, creditedAs: item.creditedAs }));
}

export async function listPublishedLessons(): Promise<Array<{ slug: string; title: string; spec: SpecWithBase }>> {
  const db = await database();
  const rows = await db.select().from(kcLessons).where(eq(kcLessons.status, "published")).orderBy(desc(kcLessons.publishedAt));
  return rows.map((row) => ({ slug: row.slug, title: row.title, spec: specOf(row) }));
}

export async function learningPaths(): Promise<LearningPath[]> {
  return buildLearningPaths(await listPublishedLessons());
}

export async function getPublishedLesson(slug: string): Promise<PublicLesson | null> {
  const db = await database();
  const [row] = await db.select().from(kcLessons).where(and(eq(kcLessons.slug, slug), eq(kcLessons.status, "published")));
  if (!row) return null;
  return { id: row.id, slug: row.slug, title: row.title, version: row.version, spec: specOf(row), credits: await publicCredits(db, row.id) };
}

/** Approved interviews waiting for lessons (editors and admins). */
export async function listApprovedProjects(userId: string) {
  const db = await database();
  const roles = await rolesOf(db, userId);
  if (!roles.has("editor") && !roles.has("admin")) throw new CaptureError(403, "Only an editor can see approved interviews.");
  const projects = await db.select().from(kcProjects).where(inArray(kcProjects.status, ["approved", "published"])).orderBy(desc(kcProjects.updatedAt));
  const lessonRows = projects.length ? await db.select({ projectId: kcLessons.projectId, status: kcLessons.status }).from(kcLessons).where(inArray(kcLessons.projectId, projects.map((p) => p.id))) : [];
  const names = projects.length ? await db.select().from(kcContributors).where(inArray(kcContributors.userId, projects.map((p) => p.contributorId))) : [];
  return projects.map((project) => ({
    id: project.id,
    title: project.title,
    status: project.status,
    contributor: names.find((n) => n.userId === project.contributorId)?.publicName ?? "Contributor",
    lessons: lessonRows.filter((row) => row.projectId === project.id).length,
    published: lessonRows.filter((row) => row.projectId === project.id && row.status === "published").length,
    updatedAt: iso(project.updatedAt),
  }));
}
