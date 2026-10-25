import type { PackageMode } from "./knowledge-package";
import type { Timeline } from "./timeline";
import type { Fact } from "./types";

/**
 * Quality gates (specification section 14). A package or lesson that fails any blocking gate cannot be published; it goes
 * back for correction. Each gate states what is wrong in plain words so the contributor or editor knows what to fix.
 */

export type Gate = { id: string; label: string; passed: boolean; blocking: boolean; detail: string };

export const REQUIRED_CONSENTS = ["recording", "transcription", "ai_processing", "content_generation", "publication"] as const;
export type ConsentPurpose = (typeof REQUIRED_CONSENTS)[number] | "avatar_voice";

export type ConsentState = Partial<Record<ConsentPurpose, boolean>>;

export const CONSENT_LABELS: Record<ConsentPurpose, string> = {
  recording: "Record this conversation",
  transcription: "Turn the conversation into a written transcript",
  ai_processing: "Use AI to read the transcript and propose structured knowledge",
  content_generation: "Create lessons from the knowledge I approve",
  publication: "Publish approved lessons under my name",
  avatar_voice: "Use a synthetic voice or likeness of me (separate, optional)",
};

export type PackageGateInput = {
  consents: ConsentState;
  facts: Fact[];
  uploads: Array<{ filename: string; extractionStatus: string; ownership: string }>;
  timeline: Timeline;
  contributorApproved: boolean;
  mode: PackageMode;
  segmentsExist: Set<string>;
};

export function evaluatePackageGates(input: PackageGateInput): Gate[] {
  const gates: Gate[] = [];
  const live = input.facts.filter((fact) => fact.reviewStatus !== "rejected");
  const missingConsents = REQUIRED_CONSENTS.filter((purpose) => !input.consents[purpose]);
  gates.push({
    id: "consent",
    label: "Consent recorded for every purpose",
    passed: missingConsents.length === 0,
    blocking: true,
    detail: missingConsents.length ? `Missing: ${missingConsents.map((p) => CONSENT_LABELS[p]).join("; ")}.` : "Recording, transcription, AI processing, content creation and publication are all consented.",
  });

  const unprocessed = input.uploads.filter((upload) => upload.extractionStatus !== "extracted");
  gates.push({
    id: "sources_processed",
    label: "Source material processed",
    passed: unprocessed.length === 0,
    blocking: true,
    detail: unprocessed.length ? `Not yet readable: ${unprocessed.map((upload) => upload.filename).join(", ")}.` : "Every upload was read, or none were added.",
  });

  const unsourced = live.filter((fact) => fact.kind !== "editorial" && fact.sources.every((source) => !input.segmentsExist.has(source.segmentId)));
  gates.push({
    id: "traceability",
    label: "Every claim traces to a source",
    passed: unsourced.length === 0,
    blocking: true,
    detail: unsourced.length ? `${unsourced.length} statement(s) have no source: ${unsourced.slice(0, 3).map((f) => f.title).join("; ")}.` : "Every statement links to a transcript passage or an uploaded document.",
  });

  const conflicts = input.timeline.flags.filter((flag) => flag.severity === "conflict");
  gates.push({
    id: "contradictions",
    label: "Contradictions resolved",
    passed: conflicts.length === 0,
    blocking: true,
    detail: conflicts.length ? conflicts.map((flag) => flag.message).join(" ") : "No date conflicts remain. Overlaps and gaps are disclosed in the document.",
  });

  const unsettled = live.filter((fact) => fact.sensitivity !== "none" && fact.permission === "unset");
  gates.push({
    id: "confidentiality",
    label: "Sensitive details settled",
    passed: unsettled.length === 0,
    blocking: true,
    detail: unsettled.length ? `${unsettled.length} statement(s) may be sensitive and need a choice: share, anonymise or keep private.` : "No unresolved sensitive details.",
  });

  const badUploads = input.uploads.filter((upload) => upload.ownership !== "mine" && upload.ownership !== "permission");
  gates.push({
    id: "rights",
    label: "Rights to uploaded material confirmed",
    passed: badUploads.length === 0,
    blocking: true,
    detail: badUploads.length ? `Confirm you own or may share: ${badUploads.map((upload) => upload.filename).join(", ")}.` : "Ownership or permission is declared for every upload.",
  });

  const pending = live.filter((fact) => fact.reviewStatus === "proposed" || fact.reviewStatus === "needs_confirmation");
  gates.push({
    id: "review",
    label: "Contributor has reviewed the facts",
    passed: pending.length === 0,
    // Unreviewed statements never reach a publication, so they do not block it; they are listed so nothing is forgotten.
    blocking: false,
    detail: pending.length ? `${pending.length} statement(s) still await your confirmation or correction. They stay out of anything published.` : "Every statement is confirmed, corrected or rejected.",
  });

  const confirmed = live.filter((fact) => fact.reviewStatus === "confirmed" || fact.reviewStatus === "corrected");
  gates.push({
    id: "enough_content",
    label: "Enough confirmed knowledge to teach from",
    passed: confirmed.length >= 5,
    blocking: input.mode === "publish",
    detail: confirmed.length >= 5 ? `${confirmed.length} confirmed statements.` : `Only ${confirmed.length} confirmed so far; at least five are needed.`,
  });

  gates.push({
    id: "approval",
    label: "Contributor approval recorded",
    passed: input.contributorApproved,
    blocking: true,
    detail: input.contributorApproved ? "Approved by the contributor." : "The contributor has not approved this version yet.",
  });
  return gates;
}

export function blockingFailures(gates: Gate[]): Gate[] {
  return gates.filter((gate) => gate.blocking && !gate.passed);
}

export type LessonGateInput = {
  packageApproved: boolean;
  consents: ConsentState;
  usesSyntheticVoice: boolean;
  issues: Array<{ id: string; message: string }>;
  hasCaptions: boolean;
  editorApproved: boolean;
  contributorApproved: boolean;
  attributionBasisPoints: number;
  contributorCount: number;
  factsPublishable: boolean;
};

export function evaluateLessonGates(input: LessonGateInput): Gate[] {
  const g = (id: string, label: string, passed: boolean, detail: string, blocking = true): Gate => ({ id, label, passed, blocking, detail });
  return [
    g("package", "Built from an approved knowledge package", input.packageApproved, input.packageApproved ? "The contributor approved the source package." : "The knowledge package is not approved."),
    g("facts_cleared", "Every fact cleared for sharing", input.factsPublishable, input.factsPublishable ? "All source facts are confirmed and cleared for sharing." : "A source fact is no longer confirmed or cleared. Refresh the lesson."),
    g("consent", "Consent covers content creation and publication", !!input.consents.content_generation && !!input.consents.publication, "Lessons need consent to create content and to publish it."),
    g("voice", "Voice or likeness consent", !input.usesSyntheticVoice || !!input.consents.avatar_voice, input.usesSyntheticVoice ? "A synthetic voice or likeness needs its own consent." : "No synthetic voice or likeness of the contributor is used."),
    g("quality", "Objective, length, sources and screen text", input.issues.length === 0, input.issues.length ? input.issues.map((issue) => issue.message).join(" ") : "Objective, sources, duration and screen text pass."),
    g("captions", "Captions and transcript available", input.hasCaptions, input.hasCaptions ? "Every scene has narration text used as captions." : "Captions are missing."),
    g("attribution", "Attribution adds up to 100%", input.attributionBasisPoints === 10000 && input.contributorCount > 0, `Attribution is ${(input.attributionBasisPoints / 100).toFixed(2)}% across ${input.contributorCount} contributor(s).`),
    g("editor", "Editor approval recorded", input.editorApproved, input.editorApproved ? "Approved by an editor." : "An editor must approve the lesson."),
    g("contributor", "Contributor approval of the lesson", input.contributorApproved, input.contributorApproved ? "Approved by the contributor." : "The contributor has not approved this lesson."),
  ];
}
