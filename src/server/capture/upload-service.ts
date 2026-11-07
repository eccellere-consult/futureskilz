import "server-only";

import { createHash } from "node:crypto";

import { and, eq } from "drizzle-orm";

import { batchByChars } from "@/features/capture/budget";
import { ATTESTATION_VERSION } from "@/features/capture/rights";
import type { DraftFact } from "@/features/capture/extraction";
import { metricMentions, namedTools, sentencesOf } from "@/features/capture/signals";
import { roleCandidatesFromText } from "@/features/capture/timeline";
import type { Segment } from "@/features/capture/types";
import { kcFactRevisions, kcFactSources, kcFacts, kcRoles, kcSegments, kcUploads } from "@/server/db/schema";

import { readWithAi } from "./extract-ai";
import { CaptureError, audit, database, loadRoles, newUuid, nextSeq, requireProject, toSegment } from "./shared";
import { MAX_UPLOAD_BYTES, SUPPORTED_EXTENSIONS, readUpload } from "./upload-text";


const MAX_AI_BATCHES = 6;

export type UploadMeta = {
  ownership: "mine" | "permission" | "third_party" | "unknown";
  intendedUse?: string;
  roleId?: string | null;
  /** How the source arrived, and where it came from (an article address, for example). */
  sourceKind?: "file" | "pasted" | "link_text";
  sourceUrl?: string | null;
  /** The contributor ticked the attestation. Required for every source in a "source" project. */
  attested?: boolean;
};

export type UploadResult = { id: string; status: string; note: string | null; summary: string | null; factsAdded: number; rolesFound: number; duplicate: boolean };

/**
 * Stores an uploaded document's text as evidence (page, sheet and row kept as the location), proposes facts from it as
 * `source_fact`, and drafts any jobs it mentions into the timeline. The document is data to read, never instructions.
 * The original file bytes are not retained: only the checksum and the extracted text are, until a durable storage
 * provider is chosen (an open decision in the specification).
 */
export async function addUpload(userId: string, projectId: string, file: { name: string; type: string; bytes: Buffer }, meta: UploadMeta): Promise<UploadResult> {
  const db = await database();
  const project = await requireProject(db, userId, projectId);
  if (project.kind === "source") {
    if (meta.ownership === "unknown") throw new CaptureError(400, "Please say whether this material is yours, shared with your permission, or someone else's.");
    if (!meta.attested) throw new CaptureError(400, "Please tick the box confirming you may use this material before it is read.");
  }
  if (file.bytes.byteLength === 0) throw new CaptureError(400, "That file is empty.");
  if (file.bytes.byteLength > MAX_UPLOAD_BYTES) throw new CaptureError(413, "That file is larger than 5 MB.");
  const filename = file.name.replace(/[\\/\u0000-\u001f]/g, "_").slice(0, 255) || "upload";
  const checksum = createHash("sha256").update(file.bytes).digest("hex");

  const [existing] = await db.select().from(kcUploads).where(and(eq(kcUploads.projectId, projectId), eq(kcUploads.checksum, checksum)));
  if (existing) return { id: existing.id, status: existing.extractionStatus, note: "You already added this file.", summary: existing.summary, factsAdded: 0, rolesFound: 0, duplicate: true };

  const reading = await readUpload(filename, file.bytes);
  const uploadId = newUuid();
  if (meta.roleId) {
    const roles = await loadRoles(db, projectId);
    if (!roles.some((role) => role.id === meta.roleId)) throw new CaptureError(404, "That job was not found.");
  }

  return db.transaction(async (tx) => {
    await tx.insert(kcUploads).values({
      id: uploadId,
      projectId,
      uploadedBy: userId,
      filename,
      mediaType: (file.type || "application/octet-stream").slice(0, 120),
      size: file.bytes.byteLength,
      checksum,
      ownership: meta.ownership,
      intendedUse: meta.intendedUse?.slice(0, 240) ?? null,
      roleId: meta.roleId ?? null,
      extractionStatus: reading.status,
      extractionNote: reading.note?.slice(0, 400) ?? null,
      sourceKind: meta.sourceKind ?? "file",
      sourceUrl: meta.sourceUrl?.slice(0, 500) ?? null,
      attestedAt: meta.attested ? new Date() : null,
      attestationVersion: meta.attested ? ATTESTATION_VERSION : null,
    });
    if (reading.status !== "extracted") {
      await audit(tx, userId, "upload.add", "upload", uploadId, { status: reading.status });
      return { id: uploadId, status: reading.status, note: reading.note ?? null, summary: null, factsAdded: 0, rolesFound: 0, duplicate: false };
    }

    const segments: Segment[] = [];
    for (const piece of reading.pieces) {
      const id = newUuid();
      const seq = await nextSeq(tx, projectId);
      await tx.insert(kcSegments).values({ id, projectId, seq, source: "upload", speaker: "expert", text: piece.text, modality: "system", locator: piece.locator, uploadId, roleId: meta.roleId ?? null });
      const [row] = await tx.select().from(kcSegments).where(eq(kcSegments.id, id));
      segments.push(toSegment(row));
    }

    const drafts: DraftFact[] = [];
    const allTools = new Map<string, Segment>();
    for (const segment of segments) {
      for (const tool of namedTools(segment.text)) if (!allTools.has(tool)) allTools.set(tool, segment);
      for (const metric of metricMentions(segment.text).slice(0, 2)) {
        drafts.push({
          category: "kpi",
          kind: "source_fact",
          title: `Measure in ${filename}`,
          statement: metric.phrase,
          details: { definition: null, baseline: null, target: null, period: null, result: null },
          roleId: meta.roleId ?? null,
          processId: null,
          confidence: "low",
          reviewStatus: "needs_confirmation",
          sensitivity: "none",
          sources: [{ segmentId: segment.id, quote: sentencesOf(segment.text).find((s) => s.startsWith(metric.phrase.slice(0, 30))) ?? metric.phrase }],
          machineExtracted: true,
        });
      }
    }
    if (allTools.size) {
      drafts.push({
        category: "tool",
        kind: "source_fact",
        title: `Tools and methods named in ${filename}`,
        statement: `The document names these tools or methods: ${[...allTools.keys()].join(", ")}.`,
        details: { tools: [...allTools.keys()], usage: null },
        roleId: meta.roleId ?? null,
        processId: null,
        confidence: "medium",
        reviewStatus: "proposed",
        sensitivity: "none",
        sources: [...allTools.entries()].slice(0, 4).map(([tool, segment]) => ({ segmentId: segment.id, quote: sentencesOf(segment.text).find((s) => s.includes(tool)) ?? segment.text.slice(0, 200) })),
        machineExtracted: true,
      });
    }

    // Jobs named in the document join the draft timeline, unconfirmed.
    let rolesFound = 0;
    const existingRoles = await loadRoles(tx, projectId);
    let order = existingRoles.length;
    for (const segment of segments) {
      for (const candidate of roleCandidatesFromText(segment.text)) {
        const duplicate = existingRoles.some((role) => role.startYear === candidate.startYear && role.title.toLowerCase() === candidate.title.toLowerCase() && role.company.toLowerCase() === candidate.company.toLowerCase());
        if (duplicate) continue;
        await tx.insert(kcRoles).values({ projectId, company: candidate.company, title: candidate.title, startYear: candidate.startYear, endYear: candidate.endYear, ongoing: candidate.ongoing, datesApproximate: candidate.datesApproximate, sortOrder: order++, sourceSegmentId: segment.id, confirmed: false });
        rolesFound += 1;
      }
    }

    // A configured model may read the document too; its claims are checked against the text it was shown.
    // Every section is read, in batches that run side by side; a visible cap says how many were read.
    const plan = batchByChars(segments, (s) => s.text.length, 10_000, MAX_AI_BATCHES);
    const readings = await Promise.all(plan.batches.map((batch) => readWithAi({ segments: batch, question: null, roleId: meta.roleId ?? null, processId: null })));
    const rejected = readings.flatMap((r) => r?.rejected ?? []);
    for (const ai of readings) if (ai) drafts.push(...ai.facts);
    if (rejected.length) await audit(tx, userId, "extraction.rejected", "upload", uploadId, { rejected: rejected.slice(0, 8) });
    const aiNote = plan.readCount < plan.total ? ` The AI read ${plan.readCount} of ${plan.total} sections; the rest are kept as evidence but were not read by the AI.` : "";

    let added = 0;
    for (const draft of drafts) {
      if (!draft.sources.length) continue;
      const id = newUuid();
      await tx.insert(kcFacts).values({ id, projectId, roleId: draft.roleId, processId: null, category: draft.category, kind: draft.kind, title: draft.title.slice(0, 240), statement: draft.statement, details: draft.details ?? null, confidence: draft.confidence, reviewStatus: draft.reviewStatus, sensitivity: draft.sensitivity, permission: "unset", machineExtracted: true });
      for (const source of draft.sources) await tx.insert(kcFactSources).values({ factId: id, segmentId: source.segmentId, quote: source.quote });
      await tx.insert(kcFactRevisions).values({ factId: id, actorId: userId, action: "create", after: { statement: draft.statement }, reason: `Read from ${filename}` });
      added += 1;
    }

    const toolList = [...allTools.keys()].slice(0, 5);
    const summary = `${filename}: ${segments.length} section${segments.length === 1 ? "" : "s"} read${rolesFound ? `; ${rolesFound} job${rolesFound === 1 ? "" : "s"} added to your draft timeline` : ""}${toolList.length ? `; names ${toolList.join(", ")}` : ""}. ${meta.roleId ? "Linked to the job you chose." : "Not linked to a specific job."}${aiNote}${reading.note ? ` ${reading.note}` : ""}`;
    await tx.update(kcUploads).set({ summary, charCount: segments.reduce((sum, s) => sum + s.text.length, 0) }).where(eq(kcUploads.id, uploadId));
    await audit(tx, userId, "upload.add", "upload", uploadId, { sections: segments.length, facts: added, ownership: meta.ownership });
    return { id: uploadId, status: "extracted", note: null, summary, factsAdded: added, rolesFound, duplicate: false };
  });
}

export async function setUploadOwnership(userId: string, projectId: string, uploadId: string, ownership: UploadMeta["ownership"]): Promise<void> {
  const db = await database();
  await requireProject(db, userId, projectId);
  await db.update(kcUploads).set({ ownership }).where(and(eq(kcUploads.id, uploadId), eq(kcUploads.projectId, projectId)));
  await audit(db, userId, "upload.ownership", "upload", uploadId, { ownership });
}

export const uploadHelp = { maxBytes: MAX_UPLOAD_BYTES, extensions: SUPPORTED_EXTENSIONS };
