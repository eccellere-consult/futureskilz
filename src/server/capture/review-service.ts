import "server-only";

import { createHash } from "node:crypto";

import { and, desc, eq, inArray, max } from "drizzle-orm";

import { canonicalJson } from "@/features/capture/earnings/calculator";
import { buildFollowUps, renderFollowUps, renderSourceMapCsv } from "@/features/capture/followups";
import { blockingFailures, evaluatePackageGates, type ConsentState, type Gate } from "@/features/capture/gates";
import { buildKnowledgePackage, refLabel, sectionOf, type KnowledgePackage, type PackageMode } from "@/features/capture/knowledge-package";
import { openQuestions } from "@/features/capture/planner";
import { renderSkillMd, skillName, type ReviewState } from "@/features/capture/skill-md";
import { buildTimeline, type Timeline } from "@/features/capture/timeline";
import type { CareerRole, Fact, Segment } from "@/features/capture/types";
import { kcContributors, kcDocuments, kcFactRevisions, kcFactSources, kcFacts, kcLessons, kcProjects, kcSegments, kcUploads } from "@/server/db/schema";

import { currentConsents } from "./interview-service";
import { CaptureError, audit, database, iso, loadFacts, loadRoles, loadSegmentsById, newUuid, nextSeq, readState, requireProject, type Executor } from "./shared";

export function fingerprintOf(facts: Fact[]): string {
  const material = facts
    .filter((fact) => fact.reviewStatus !== "rejected")
    .map((fact) => [fact.id, fact.version, fact.reviewStatus, fact.permission, fact.statement, fact.anonymizedStatement ?? ""])
    .sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  return createHash("sha256").update(canonicalJson(material)).digest("hex");
}

async function segmentsForFacts(executor: Executor, facts: Fact[]): Promise<Segment[]> {
  const ids = Array.from(new Set(facts.flatMap((fact) => fact.sources.map((source) => source.segmentId))));
  const out: Segment[] = [];
  for (let i = 0; i < ids.length; i += 500) out.push(...(await loadSegmentsById(executor, ids.slice(i, i + 500))));
  return out;
}

export type ReviewFact = Fact & { sourceDetails: Array<{ segmentId: string; quote: string; ref: string; origin: string; locator: string | null; at: string; speaker: string }>; section: string };

export type ReviewView = {
  project: { id: string; title: string; status: string };
  facts: ReviewFact[];
  roles: CareerRole[];
  timeline: Timeline;
  gates: Gate[];
  consents: ConsentState;
  uploads: Array<{ id: string; filename: string; ownership: string; extractionStatus: string; summary: string | null; note: string | null; size: number; roleId: string | null; charCount: number }>;
  documents: Array<{ id: string; kind: string; version: number; mode: string; status: string; createdAt: string; approvedAt: string | null; stale: boolean }>;
  stats: { total: number; confirmed: number; needsAttention: number; rejected: number };
  changedSinceApproval: boolean;
  lessonsCount: number;
};

export async function getReview(userId: string, projectId: string): Promise<ReviewView> {
  const db = await database();
  const project = await requireProject(db, userId, projectId);
  const [facts, roles, uploads, docs, consents] = await Promise.all([
    loadFacts(db, projectId),
    loadRoles(db, projectId),
    db.select().from(kcUploads).where(eq(kcUploads.projectId, projectId)),
    db.select().from(kcDocuments).where(eq(kcDocuments.projectId, projectId)).orderBy(desc(kcDocuments.createdAt)),
    currentConsents(db, project.contributorId),
  ]);
  const segments = await segmentsForFacts(db, facts);
  const byId = new Map(segments.map((segment) => [segment.id, segment]));
  const timeline = buildTimeline(roles);
  const fingerprint = fingerprintOf(facts);
  const approved = docs.find((doc) => doc.status === "approved" && doc.kind === "skill_md");
  const lessonCount = await db.select({ id: kcLessons.id }).from(kcLessons).where(eq(kcLessons.projectId, projectId));

  const gates = evaluatePackageGates({
    consents,
    facts,
    uploads: uploads.map((upload) => ({ filename: upload.filename, extractionStatus: upload.extractionStatus === "unsupported" || upload.extractionStatus === "duplicate" ? "extracted" : upload.extractionStatus, ownership: upload.ownership })),
    timeline,
    contributorApproved: !!approved,
    mode: "publish",
    segmentsExist: new Set(segments.map((segment) => segment.id)),
  });

  const live = facts.filter((fact) => fact.reviewStatus !== "rejected");
  const confirmed = live.filter((fact) => fact.reviewStatus === "confirmed" || fact.reviewStatus === "corrected");
  return {
    project: { id: project.id, title: project.title, status: project.status },
    facts: facts.map((fact) => ({
      ...fact,
      section: sectionOf(fact),
      sourceDetails: fact.sources.map((source) => {
        const segment = byId.get(source.segmentId);
        return { segmentId: source.segmentId, quote: source.quote, ref: segment ? refLabel(segment) : "?", origin: segment?.source ?? "interview", locator: segment?.locator ?? null, at: segment?.createdAt ?? "", speaker: segment?.speaker ?? "expert" };
      }),
    })),
    roles,
    timeline,
    gates,
    consents,
    uploads: uploads.map((upload) => ({ id: upload.id, filename: upload.filename, ownership: upload.ownership, extractionStatus: upload.extractionStatus, summary: upload.summary, note: upload.extractionNote, size: upload.size, roleId: upload.roleId, charCount: upload.charCount })),
    documents: docs.map((doc) => ({ id: doc.id, kind: doc.kind, version: doc.version, mode: doc.mode, status: doc.status, createdAt: iso(doc.createdAt), approvedAt: doc.approvedAt ? iso(doc.approvedAt) : null, stale: doc.factFingerprint !== fingerprint })),
    stats: { total: facts.length, confirmed: confirmed.length, needsAttention: live.length - confirmed.length, rejected: facts.length - live.length },
    changedSinceApproval: !!approved && approved.factFingerprint !== fingerprint,
    lessonsCount: lessonCount.length,
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// Reviewing a fact
// ---------------------------------------------------------------------------------------------------------------------

export type FactAction =
  | { action: "confirm"; permission?: "public" | "anonymize" | "private"; anonymizedStatement?: string }
  | { action: "correct"; statement: string; permission?: "public" | "anonymize" | "private"; anonymizedStatement?: string }
  | { action: "reject" }
  | { action: "reopen" }
  | { action: "permission"; permission: "public" | "anonymize" | "private"; anonymizedStatement?: string }
  | { action: "details"; details: Record<string, string | null> };

const EDITABLE_DETAILS = ["definition", "baseline", "target", "period", "result", "usage", "unit", "owner", "cadence"];
const snapshot = (fact: Fact) => ({ statement: fact.statement, reviewStatus: fact.reviewStatus, permission: fact.permission, anonymizedStatement: fact.anonymizedStatement, details: fact.details });

export async function reviewFact(userId: string, projectId: string, factId: string, change: FactAction): Promise<Fact> {
  const db = await database();
  return db.transaction(async (tx) => {
    await requireProject(tx, userId, projectId, { forUpdate: true });
    const all = await loadFacts(tx, projectId);
    const fact = all.find((item) => item.id === factId);
    if (!fact) throw new CaptureError(404, "That statement was not found.");
    const before = snapshot(fact);
    const patch: Partial<typeof kcFacts.$inferInsert> = { version: fact.version + 1 };

    const settlePermission = (requested?: "public" | "anonymize" | "private", wording?: string) => {
      let permission = requested ?? (fact.permission === "unset" && fact.sensitivity === "none" ? "public" : fact.permission);
      if (permission === "unset" && fact.sensitivity !== "none") {
        throw new CaptureError(422, "This statement may be sensitive. Choose whether it can be shared, shared anonymised, or kept private.");
      }
      if (fact.category === "permission") permission = "private";
      patch.permission = permission;
      if (permission === "anonymize") {
        const text = (wording ?? fact.anonymizedStatement ?? "").trim();
        if (text.length < 5) throw new CaptureError(422, "Write the anonymised wording you are happy to share, with names and identifying details removed.");
        patch.anonymizedStatement = text.slice(0, 1500);
      }
    };

    switch (change.action) {
      case "confirm":
        settlePermission(change.permission, change.anonymizedStatement);
        patch.reviewStatus = "confirmed";
        break;
      case "correct": {
        const text = change.statement.trim();
        if (text.length < 3 || text.length > 1500) throw new CaptureError(400, "Write the corrected statement in your own words (up to 1,500 characters).");
        // The correction is itself evidence: append it to the transcript, link it to the fact, keep the old source.
        const seq = await nextSeq(tx, projectId);
        const segmentId = newUuid();
        await tx.insert(kcSegments).values({ id: segmentId, projectId, seq, source: "correction", speaker: "expert", text: `Correction to "${fact.title}": ${text}`, modality: "text", roleId: fact.roleId });
        await tx.insert(kcFactSources).values({ factId, segmentId, quote: text });
        patch.statement = text;
        patch.kind = "direct_statement";
        patch.reviewStatus = "corrected";
        patch.confidence = "high";
        patch.machineExtracted = false;
        settlePermission(change.permission, change.anonymizedStatement);
        break;
      }
      case "reject":
        patch.reviewStatus = "rejected";
        break;
      case "reopen":
        patch.reviewStatus = "proposed";
        break;
      case "permission":
        settlePermission(change.permission, change.anonymizedStatement);
        break;
      case "details": {
        const merged = { ...(fact.details ?? {}) } as Record<string, unknown>;
        for (const [key, value] of Object.entries(change.details)) {
          if (!EDITABLE_DETAILS.includes(key)) continue;
          merged[key] = value && value.trim() ? value.trim().slice(0, 600) : null;
        }
        patch.details = merged;
        // The contributor supplied the specifics themselves, so this is now their statement to confirm.
        if (fact.reviewStatus === "needs_confirmation") patch.reviewStatus = "proposed";
        break;
      }
    }

    await tx.update(kcFacts).set(patch).where(and(eq(kcFacts.id, factId), eq(kcFacts.projectId, projectId)));
    await tx.insert(kcFactRevisions).values({ factId, actorId: userId, action: change.action, before, after: patch as Record<string, unknown> });
    await audit(tx, userId, `fact.${change.action}`, "fact", factId);
    const updated = (await loadFacts(tx, projectId)).find((item) => item.id === factId)!;
    return updated;
  });
}

/** Confirms every statement that is plain (not sensitive, not a bare stub) in one step, so review stays short. */
export async function confirmAllPlain(userId: string, projectId: string): Promise<{ confirmed: number; skipped: number }> {
  const db = await database();
  const facts = await loadFacts(db, projectId);
  await requireProject(db, userId, projectId);
  let confirmed = 0;
  let skipped = 0;
  for (const fact of facts) {
    if (fact.reviewStatus !== "proposed") continue;
    if (fact.sensitivity !== "none" || fact.kind === "ai_synthesis") {
      skipped += 1;
      continue;
    }
    await reviewFact(userId, projectId, fact.id, { action: "confirm" });
    confirmed += 1;
  }
  return { confirmed, skipped };
}

// ---------------------------------------------------------------------------------------------------------------------
// Documents: knowledge package, skill.md, follow-ups, source map
// ---------------------------------------------------------------------------------------------------------------------

async function nextVersion(executor: Executor, projectId: string, kind: (typeof kcDocuments.$inferSelect)["kind"]): Promise<number> {
  const [row] = await executor.select({ top: max(kcDocuments.version) }).from(kcDocuments).where(and(eq(kcDocuments.projectId, projectId), eq(kcDocuments.kind, kind)));
  return (row?.top ?? 0) + 1;
}

type BuildInput = { executor: Executor; userId: string; projectId: string; mode: PackageMode; status: ReviewState };

async function buildDocuments(input: BuildInput) {
  const { executor, projectId, mode, status } = input;
  const project = await requireProject(executor, input.userId, projectId);
  const [facts, roles, uploads, consents] = await Promise.all([
    loadFacts(executor, projectId),
    loadRoles(executor, projectId),
    executor.select().from(kcUploads).where(eq(kcUploads.projectId, projectId)),
    currentConsents(executor, project.contributorId),
  ]);
  const segments = await segmentsForFacts(executor, facts);
  const [contributor] = await executor.select().from(kcContributors).where(eq(kcContributors.userId, project.contributorId));
  const timeline = buildTimeline(roles);
  const pkg = buildKnowledgePackage({ facts, segments, mode });
  const state = readState(project);
  const open = openQuestions(state, { roles, known: [], now: new Date().toISOString() }, 40);
  const generatedAt = new Date().toISOString();
  const name = contributor?.publicName ?? "Contributor";
  const version = (await nextVersion(executor, projectId, "skill_md")) + ".0";
  const skill = renderSkillMd(pkg, {
    title: project.title,
    slug: skillName(name, project.title),
    version,
    status,
    generatedAt,
    contributorName: name,
    showProfile: !!consents.publication,
    roles,
    timeline,
    openQuestions: open,
    uploads: uploads.map((upload) => ({ filename: upload.filename, status: upload.extractionStatus, ownership: upload.ownership })),
    consents: Object.entries(consents).map(([purpose, granted]) => ({ purpose, granted: !!granted })),
  });
  const followUps = buildFollowUps({ open, facts, timeline });
  const sourceRows = pkg.sourceMap.map((source) => ({
    ref: source.ref,
    origin: source.origin,
    locator: source.locator,
    quote: source.quote,
    facts: pkg.sections.flatMap((section) => section.items).filter((item) => item.refs.includes(source.ref)).map((item) => item.title).slice(0, 6),
  }));
  return { facts, pkg, skill, followUps: renderFollowUps(followUps, generatedAt), sourceCsv: renderSourceMapCsv(sourceRows), fingerprint: fingerprintOf(facts), timeline, roles, consents, uploads, segments, version };
}

async function saveDocuments(tx: Executor, userId: string, projectId: string, mode: PackageMode, status: ReviewState, built: Awaited<ReturnType<typeof buildDocuments>>, approvedBy?: string) {
  const entries: Array<{ kind: (typeof kcDocuments.$inferInsert)["kind"]; content: string; data?: Record<string, unknown> }> = [
    { kind: "knowledge_package", content: JSON.stringify(built.pkg, null, 2), data: { stats: built.pkg.stats } },
    { kind: "skill_md", content: built.skill },
    { kind: "follow_up_questions", content: built.followUps },
    { kind: "source_map", content: built.sourceCsv },
  ];
  const ids: Record<string, string> = {};
  for (const entry of entries) {
    // A newer version supersedes drafts of the same kind; an approved snapshot is replaced only by a newer approval.
    const olderStatuses: Array<(typeof kcDocuments.$inferSelect)["status"]> = status === "approved" ? ["draft", "awaiting-contributor-review", "approved"] : ["draft", "awaiting-contributor-review"];
    await tx.update(kcDocuments).set({ status: "superseded" }).where(and(eq(kcDocuments.projectId, projectId), eq(kcDocuments.kind, entry.kind), inArray(kcDocuments.status, olderStatuses)));
    const id = newUuid();
    await tx.insert(kcDocuments).values({
      id,
      projectId,
      kind: entry.kind,
      version: await nextVersion(tx, projectId, entry.kind),
      mode,
      status,
      content: entry.content,
      data: entry.data ?? null,
      factFingerprint: built.fingerprint,
      createdBy: userId,
      approvedBy: approvedBy ?? null,
      approvedAt: approvedBy ? new Date() : null,
    });
    ids[entry.kind] = id;
  }
  return ids;
}

/** Regenerates the working draft (every statement not rejected, each labelled) for the contributor to review. */
export async function generateDraft(userId: string, projectId: string): Promise<{ skillMd: string; stats: KnowledgePackage["stats"] }> {
  const db = await database();
  return db.transaction(async (tx) => {
    await requireProject(tx, userId, projectId, { forUpdate: true });
    const built = await buildDocuments({ executor: tx, userId, projectId, mode: "draft", status: "awaiting-contributor-review" });
    await saveDocuments(tx, userId, projectId, "draft", "awaiting-contributor-review", built);
    await audit(tx, userId, "documents.draft", "project", projectId, { fingerprint: built.fingerprint });
    return { skillMd: built.skill, stats: built.pkg.stats };
  });
}

export type ApprovalResult = { approved: true; gates: Gate[] } | { approved: false; gates: Gate[] };

/** The contributor approves what can be published. Every blocking gate must pass; otherwise nothing changes. */
export async function approvePackage(userId: string, projectId: string): Promise<ApprovalResult> {
  const db = await database();
  return db.transaction(async (tx) => {
    const project = await requireProject(tx, userId, projectId, { forUpdate: true });
    if (project.status === "withdrawn") throw new CaptureError(409, "This interview was withdrawn.");
    const built = await buildDocuments({ executor: tx, userId, projectId, mode: "publish", status: "approved" });
    const gates = evaluatePackageGates({
      consents: built.consents,
      facts: built.facts,
      uploads: built.uploads.map((upload) => ({ filename: upload.filename, extractionStatus: upload.extractionStatus === "unsupported" || upload.extractionStatus === "duplicate" ? "extracted" : upload.extractionStatus, ownership: upload.ownership })),
      timeline: built.timeline,
      contributorApproved: true,
      mode: "publish",
      segmentsExist: new Set(built.segments.map((segment) => segment.id)),
    });
    if (blockingFailures(gates).length > 0) return { approved: false, gates };
    await saveDocuments(tx, userId, projectId, "publish", "approved", built, userId);
    await tx.update(kcProjects).set({ status: "approved" }).where(eq(kcProjects.id, projectId));
    await audit(tx, userId, "package.approve", "project", projectId, { fingerprint: built.fingerprint, items: built.pkg.stats.included });
    return { approved: true, gates };
  });
}

/** Takes the contributor's knowledge out of circulation: lessons are retired and the project stops accepting work. */
export async function withdrawProject(userId: string, projectId: string, reason: string): Promise<void> {
  const db = await database();
  await db.transaction(async (tx) => {
    await requireProject(tx, userId, projectId, { forUpdate: true });
    await tx.update(kcLessons).set({ status: "retired" }).where(eq(kcLessons.projectId, projectId));
    await tx.update(kcDocuments).set({ status: "superseded" }).where(and(eq(kcDocuments.projectId, projectId), inArray(kcDocuments.status, ["approved", "published"])));
    await tx.update(kcProjects).set({ status: "withdrawn" }).where(eq(kcProjects.id, projectId));
    await audit(tx, userId, "project.withdraw", "project", projectId, { reason: reason.slice(0, 400) });
  });
}

export async function getDocument(userId: string, projectId: string, kind: "knowledge_package" | "skill_md" | "follow_up_questions" | "source_map", options: { version?: number; approved?: boolean } = {}) {
  const db = await database();
  await requireProject(db, userId, projectId, { staff: true });
  const rows = await db.select().from(kcDocuments).where(and(eq(kcDocuments.projectId, projectId), eq(kcDocuments.kind, kind))).orderBy(desc(kcDocuments.version));
  const pick = options.version ? rows.find((row) => row.version === options.version) : options.approved ? rows.find((row) => row.status === "approved" || row.status === "published") : rows[0];
  if (!pick) throw new CaptureError(404, "That document has not been generated yet.");
  return { id: pick.id, kind: pick.kind, version: pick.version, status: pick.status, mode: pick.mode, content: pick.content, createdAt: iso(pick.createdAt) };
}

