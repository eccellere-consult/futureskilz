import {
  bigint,
  boolean,
  datetime,
  index,
  int,
  longtext,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

import { createdAtColumn, idColumn, jsonColumn, referenceColumn, updatedAtColumn } from "./columns";
import { users } from "./core";

/**
 * Expert capture, knowledge engineering, lesson production and the earnings ledger (the `kc_` tables).
 *
 * Three rules shape these tables:
 * - Evidence is append-only. `kc_segments` is never updated or deleted; a correction is a new segment, and facts point at
 *   segments, so every claim stays traceable to what was actually said or uploaded.
 * - A fact carries its own review state. Nothing reaches a published document unless the contributor confirmed it.
 * - Attribution and usage exist from the first lesson. `kc_lesson_attribution` says who is credited; `kc_learning_events`
 *   and `kc_feedback` record every view, completion, material use and rating, so any later revenue policy can be applied
 *   to history and audited.
 */

export const kcContributors = mysqlTable("kc_contributors", {
  userId: referenceColumn("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  publicName: varchar("public_name", { length: 160 }).notNull(),
  headline: varchar("headline", { length: 240 }),
  language: varchar("language", { length: 16 }).notNull().default("en"),
  status: mysqlEnum("status", ["active", "paused", "withdrawn"]).notNull().default("active"),
  createdAt: createdAtColumn(),
  updatedAt: updatedAtColumn(),
});

export const kcProjects = mysqlTable(
  "kc_projects",
  {
    id: idColumn().primaryKey(),
    contributorId: referenceColumn("contributor_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    title: varchar("title", { length: 200 }).notNull(),
    status: mysqlEnum("status", ["interviewing", "in_review", "approved", "published", "withdrawn"]).notNull().default("interviewing"),
    language: varchar("language", { length: 16 }).notNull().default("en"),
    targetTopics: jsonColumn<string[]>("target_topics"),
    /** The interview checkpoint: stage, what was asked, what is open, the prompt on screen. Resuming loads this. */
    state: jsonColumn<Record<string, unknown>>("state").notNull(),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => [index("kc_projects_contributor_idx").on(table.contributorId, table.status)],
);

/** Consent is recorded per purpose and never overwritten: the latest row for a purpose is the current answer. */
export const kcConsents = mysqlTable(
  "kc_consents",
  {
    id: idColumn().primaryKey(),
    contributorId: referenceColumn("contributor_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    projectId: referenceColumn("project_id").references(() => kcProjects.id, { onDelete: "set null" }),
    purpose: varchar("purpose", { length: 40 }).notNull(),
    granted: boolean("granted").notNull(),
    termsVersion: varchar("terms_version", { length: 24 }).notNull(),
    createdAt: createdAtColumn(),
  },
  (table) => [index("kc_consents_contributor_idx").on(table.contributorId, table.purpose, table.createdAt)],
);

export const kcSessions = mysqlTable(
  "kc_sessions",
  {
    id: idColumn().primaryKey(),
    projectId: referenceColumn("project_id").notNull().references(() => kcProjects.id, { onDelete: "cascade" }),
    number: int("number").notNull(),
    startedAt: timestamp("started_at").notNull().defaultNow(),
    endedAt: datetime("ended_at"),
    summary: text("summary"),
  },
  (table) => [uniqueIndex("kc_sessions_project_number_idx").on(table.projectId, table.number)],
);

/** Source evidence. Append-only: never updated, never deleted while the project exists. */
export const kcSegments = mysqlTable(
  "kc_segments",
  {
    id: idColumn().primaryKey(),
    projectId: referenceColumn("project_id").notNull().references(() => kcProjects.id, { onDelete: "cascade" }),
    sessionId: referenceColumn("session_id").references(() => kcSessions.id, { onDelete: "set null" }),
    seq: int("seq").notNull(),
    source: mysqlEnum("source", ["interview", "upload", "correction"]).notNull(),
    speaker: mysqlEnum("speaker", ["expert", "companion"]).notNull(),
    text: longtext("text").notNull(),
    modality: mysqlEnum("modality", ["voice", "text", "system"]).notNull().default("text"),
    locator: varchar("locator", { length: 120 }),
    uploadId: referenceColumn("upload_id"),
    roleId: referenceColumn("role_id"),
    questionKey: varchar("question_key", { length: 40 }),
    createdAt: timestamp("created_at", { fsp: 3 }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("kc_segments_project_seq_idx").on(table.projectId, table.seq)],
);

export const kcRoles = mysqlTable(
  "kc_roles",
  {
    id: idColumn().primaryKey(),
    projectId: referenceColumn("project_id").notNull().references(() => kcProjects.id, { onDelete: "cascade" }),
    company: varchar("company", { length: 200 }).notNull().default(""),
    title: varchar("title", { length: 200 }).notNull().default(""),
    industry: varchar("industry", { length: 160 }).notNull().default(""),
    location: varchar("location", { length: 160 }).notNull().default(""),
    startYear: int("start_year"),
    endYear: int("end_year"),
    ongoing: boolean("ongoing").notNull().default(false),
    datesApproximate: boolean("dates_approximate").notNull().default(false),
    summary: text("summary"),
    sortOrder: int("sort_order").notNull().default(0),
    confirmed: boolean("confirmed").notNull().default(false),
    sourceSegmentId: referenceColumn("source_segment_id"),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => [index("kc_roles_project_idx").on(table.projectId, table.sortOrder)],
);

export const kcUploads = mysqlTable(
  "kc_uploads",
  {
    id: idColumn().primaryKey(),
    projectId: referenceColumn("project_id").notNull().references(() => kcProjects.id, { onDelete: "cascade" }),
    uploadedBy: referenceColumn("uploaded_by").notNull().references(() => users.id, { onDelete: "restrict" }),
    filename: varchar("filename", { length: 255 }).notNull(),
    mediaType: varchar("media_type", { length: 120 }).notNull(),
    size: int("size").notNull(),
    checksum: varchar("checksum", { length: 64 }).notNull(),
    ownership: mysqlEnum("ownership", ["unknown", "mine", "permission", "third_party"]).notNull().default("unknown"),
    intendedUse: varchar("intended_use", { length: 240 }),
    roleId: referenceColumn("role_id"),
    extractionStatus: mysqlEnum("extraction_status", ["pending", "extracted", "failed", "unsupported", "duplicate"]).notNull().default("pending"),
    extractionNote: varchar("extraction_note", { length: 400 }),
    summary: text("summary"),
    charCount: int("char_count").notNull().default(0),
    createdAt: createdAtColumn(),
  },
  (table) => [uniqueIndex("kc_uploads_project_checksum_idx").on(table.projectId, table.checksum)],
);

export const kcFacts = mysqlTable(
  "kc_facts",
  {
    id: idColumn().primaryKey(),
    projectId: referenceColumn("project_id").notNull().references(() => kcProjects.id, { onDelete: "cascade" }),
    roleId: referenceColumn("role_id"),
    processId: referenceColumn("process_id"),
    category: varchar("category", { length: 24 }).notNull(),
    kind: mysqlEnum("kind", ["direct_statement", "source_fact", "ai_synthesis", "editorial"]).notNull(),
    title: varchar("title", { length: 240 }).notNull(),
    statement: longtext("statement").notNull(),
    details: jsonColumn<Record<string, unknown>>("details"),
    confidence: mysqlEnum("confidence", ["high", "medium", "low"]).notNull().default("medium"),
    reviewStatus: mysqlEnum("review_status", ["proposed", "needs_confirmation", "confirmed", "corrected", "rejected"]).notNull().default("proposed"),
    sensitivity: mysqlEnum("sensitivity", ["none", "possible", "confirmed"]).notNull().default("none"),
    permission: mysqlEnum("permission", ["unset", "public", "anonymize", "private"]).notNull().default("unset"),
    anonymizedStatement: text("anonymized_statement"),
    machineExtracted: boolean("machine_extracted").notNull().default(true),
    version: int("version").notNull().default(1),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => [index("kc_facts_project_idx").on(table.projectId, table.reviewStatus), index("kc_facts_role_idx").on(table.projectId, table.roleId)],
);

export const kcFactSources = mysqlTable(
  "kc_fact_sources",
  {
    id: idColumn().primaryKey(),
    factId: referenceColumn("fact_id").notNull().references(() => kcFacts.id, { onDelete: "cascade" }),
    segmentId: referenceColumn("segment_id").notNull().references(() => kcSegments.id, { onDelete: "restrict" }),
    quote: text("quote").notNull(),
  },
  (table) => [index("kc_fact_sources_fact_idx").on(table.factId), index("kc_fact_sources_segment_idx").on(table.segmentId)],
);

/** Every confirmation, correction, rejection and permission change, with what it was before. */
export const kcFactRevisions = mysqlTable(
  "kc_fact_revisions",
  {
    id: idColumn().primaryKey(),
    factId: referenceColumn("fact_id").notNull().references(() => kcFacts.id, { onDelete: "cascade" }),
    actorId: referenceColumn("actor_id"),
    action: varchar("action", { length: 24 }).notNull(),
    before: jsonColumn<Record<string, unknown>>("before"),
    after: jsonColumn<Record<string, unknown>>("after"),
    reason: varchar("reason", { length: 400 }),
    createdAt: createdAtColumn(),
  },
  (table) => [index("kc_fact_revisions_fact_idx").on(table.factId, table.createdAt)],
);

/** Generated documents (knowledge package, skill.md, follow-up questions), versioned. A new version supersedes, never edits. */
export const kcDocuments = mysqlTable(
  "kc_documents",
  {
    id: idColumn().primaryKey(),
    projectId: referenceColumn("project_id").notNull().references(() => kcProjects.id, { onDelete: "cascade" }),
    kind: mysqlEnum("kind", ["knowledge_package", "skill_md", "follow_up_questions", "source_map"]).notNull(),
    version: int("version").notNull(),
    mode: mysqlEnum("mode", ["draft", "publish"]).notNull(),
    status: mysqlEnum("status", ["draft", "awaiting-contributor-review", "approved", "published", "superseded"]).notNull().default("draft"),
    content: longtext("content").notNull(),
    data: jsonColumn<Record<string, unknown>>("data"),
    /** Hash of the facts this version was built from, so a stale document is recognised. */
    factFingerprint: varchar("fact_fingerprint", { length: 64 }).notNull(),
    approvedBy: referenceColumn("approved_by"),
    approvedAt: datetime("approved_at"),
    createdBy: referenceColumn("created_by"),
    createdAt: createdAtColumn(),
  },
  (table) => [uniqueIndex("kc_documents_version_idx").on(table.projectId, table.kind, table.version)],
);

export const kcLessons = mysqlTable(
  "kc_lessons",
  {
    id: idColumn().primaryKey(),
    slug: varchar("slug", { length: 120 }).notNull(),
    projectId: referenceColumn("project_id").notNull().references(() => kcProjects.id, { onDelete: "restrict" }),
    /** The primary contributor. Full credit lives in kc_lesson_attribution. */
    contributorId: referenceColumn("contributor_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    version: int("version").notNull().default(1),
    status: mysqlEnum("status", ["draft", "in_review", "awaiting_contributor", "approved", "published", "retired"]).notNull().default("draft"),
    title: varchar("title", { length: 240 }).notNull(),
    stage: varchar("stage", { length: 24 }).notNull(),
    proficiency: varchar("proficiency", { length: 24 }).notNull(),
    roleLabel: varchar("role_label", { length: 200 }).notNull().default(""),
    industry: varchar("industry", { length: 160 }).notNull().default(""),
    durationSeconds: int("duration_seconds").notNull().default(0),
    spec: jsonColumn<Record<string, unknown>>("spec").notNull(),
    factIds: jsonColumn<string[]>("fact_ids").notNull(),
    issues: jsonColumn<Array<{ id: string; message: string }>>("issues"),
    editorApprovedBy: referenceColumn("editor_approved_by"),
    editorApprovedAt: datetime("editor_approved_at"),
    contributorApprovedAt: datetime("contributor_approved_at"),
    publishedAt: datetime("published_at"),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => [uniqueIndex("kc_lessons_slug_idx").on(table.slug), index("kc_lessons_status_idx").on(table.status), index("kc_lessons_project_idx").on(table.projectId)],
);

export const kcLessonAttribution = mysqlTable(
  "kc_lesson_attribution",
  {
    lessonId: referenceColumn("lesson_id").notNull().references(() => kcLessons.id, { onDelete: "cascade" }),
    contributorId: referenceColumn("contributor_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    /** Basis points; the rows of one lesson add up to 10000. */
    shareBp: int("share_bp").notNull(),
    creditedAs: varchar("credited_as", { length: 24 }).notNull().default("author"),
  },
  (table) => [uniqueIndex("kc_lesson_attribution_idx").on(table.lessonId, table.contributorId)],
);

/** Every learner interaction, append-only. `dedupe_key` makes a retried request harmless. */
export const kcLearningEvents = mysqlTable(
  "kc_learning_events",
  {
    id: idColumn().primaryKey(),
    lessonId: referenceColumn("lesson_id").notNull().references(() => kcLessons.id, { onDelete: "restrict" }),
    lessonVersion: int("lesson_version").notNull(),
    /** A keyed hash of the learner, never the learner's email or name. */
    learnerRef: varchar("learner_ref", { length: 64 }).notNull(),
    eventType: mysqlEnum("event_type", ["start", "progress", "complete", "material_use", "check_result", "return"]).notNull(),
    seconds: int("seconds").notNull().default(0),
    value: int("value"),
    dedupeKey: varchar("dedupe_key", { length: 120 }).notNull(),
    occurredAt: timestamp("occurred_at", { fsp: 3 }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("kc_events_dedupe_idx").on(table.dedupeKey), index("kc_events_lesson_idx").on(table.lessonId, table.occurredAt)],
);

export const kcFeedback = mysqlTable(
  "kc_feedback",
  {
    id: idColumn().primaryKey(),
    lessonId: referenceColumn("lesson_id").notNull().references(() => kcLessons.id, { onDelete: "restrict" }),
    lessonVersion: int("lesson_version").notNull(),
    learnerRef: varchar("learner_ref", { length: 64 }).notNull(),
    rating: int("rating").notNull(),
    useful: boolean("useful"),
    comment: text("comment"),
    moderation: mysqlEnum("moderation", ["visible", "held", "removed"]).notNull().default("visible"),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => [uniqueIndex("kc_feedback_learner_idx").on(table.lessonId, table.learnerRef)],
);

export const kcRevenuePolicies = mysqlTable(
  "kc_revenue_policies",
  {
    id: idColumn().primaryKey(),
    version: varchar("version", { length: 40 }).notNull(),
    status: mysqlEnum("status", ["draft", "approved", "retired"]).notNull().default("draft"),
    definition: jsonColumn<Record<string, unknown>>("definition").notNull(),
    approvedBy: referenceColumn("approved_by"),
    approvedAt: datetime("approved_at"),
    createdBy: referenceColumn("created_by"),
    createdAt: createdAtColumn(),
  },
  (table) => [uniqueIndex("kc_policies_version_idx").on(table.version)],
);

export const kcReceipts = mysqlTable(
  "kc_receipts",
  {
    id: idColumn().primaryKey(),
    externalRef: varchar("external_ref", { length: 120 }).notNull(),
    grossMinor: bigint("gross_minor", { mode: "number" }).notNull(),
    refundMinor: bigint("refund_minor", { mode: "number" }).notNull().default(0),
    feeMinor: bigint("fee_minor", { mode: "number" }).notNull().default(0),
    taxMinor: bigint("tax_minor", { mode: "number" }).notNull().default(0),
    currency: varchar("currency", { length: 3 }).notNull(),
    status: mysqlEnum("status", ["eligible", "held", "refunded", "disputed"]).notNull().default("eligible"),
    receivedAt: datetime("received_at").notNull(),
    recordedBy: referenceColumn("recorded_by"),
    createdAt: createdAtColumn(),
  },
  (table) => [uniqueIndex("kc_receipts_ref_idx").on(table.externalRef)],
);

export const kcStatements = mysqlTable(
  "kc_statements",
  {
    id: idColumn().primaryKey(),
    contributorId: referenceColumn("contributor_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    policyId: referenceColumn("policy_id").notNull().references(() => kcRevenuePolicies.id, { onDelete: "restrict" }),
    periodStart: datetime("period_start").notNull(),
    periodEnd: datetime("period_end").notNull(),
    status: mysqlEnum("status", ["illustrative", "draft", "final", "disputed", "paid", "void"]).notNull().default("draft"),
    currency: varchar("currency", { length: 3 }).notNull(),
    totalMinor: bigint("total_minor", { mode: "number" }).notNull().default(0),
    payload: jsonColumn<Record<string, unknown>>("payload").notNull(),
    inputsHash: varchar("inputs_hash", { length: 64 }).notNull(),
    disputeNote: text("dispute_note"),
    createdBy: referenceColumn("created_by"),
    createdAt: createdAtColumn(),
    finalizedAt: datetime("finalized_at"),
  },
  (table) => [uniqueIndex("kc_statements_run_idx").on(table.contributorId, table.policyId, table.periodStart, table.periodEnd, table.inputsHash)],
);

export const kcAudit = mysqlTable(
  "kc_audit",
  {
    id: idColumn().primaryKey(),
    actorId: referenceColumn("actor_id"),
    action: varchar("action", { length: 60 }).notNull(),
    entity: varchar("entity", { length: 40 }).notNull(),
    entityId: referenceColumn("entity_id"),
    meta: jsonColumn<Record<string, unknown>>("meta"),
    createdAt: createdAtColumn(),
  },
  (table) => [index("kc_audit_entity_idx").on(table.entity, table.entityId, table.createdAt)],
);

/**
 * A book written from one interview project: the manuscript as structured JSON, the print-ready PDFs and the cover art.
 * One book per project. The author approves it before it is shared or published; the PDFs are kept as base64 text so the book
 * can be rebuilt and downloaded without a file store (Hostinger has none).
 */
export const bookProjects = mysqlTable(
  "book_projects",
  {
    id: idColumn().primaryKey(),
    projectId: referenceColumn("project_id").notNull().references(() => kcProjects.id, { onDelete: "cascade" }),
    contributorId: referenceColumn("contributor_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    status: mysqlEnum("status", ["writing", "ready", "failed", "approved"]).notNull().default("writing"),
    step: varchar("step", { length: 120 }).notNull().default(""),
    book: jsonColumn<Record<string, unknown>>("book"),
    source: varchar("source", { length: 16 }).notNull().default("outline"),
    pageCount: int("page_count"),
    interiorPdf: longtext("interior_pdf"),
    coverPdf: longtext("cover_pdf"),
    coverArt: longtext("cover_art"),
    error: text("error"),
    approvedAt: datetime("approved_at"),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => [uniqueIndex("book_projects_project_idx").on(table.projectId), index("book_projects_contributor_idx").on(table.contributorId, table.updatedAt)],
);

/**
 * Something the fraud rules noticed, for a person to review. A flag changes nothing until an admin confirms it: an open flag only
 * lowers a lesson's trust a little, and a confirmed learner flag removes that learner's activity from allocations.
 * One flag per subject, rule and window, so a rescan does not pile up duplicates.
 */
export const fraudFlags = mysqlTable(
  "fraud_flags",
  {
    id: idColumn().primaryKey(),
    subjectType: mysqlEnum("subject_type", ["learner", "lesson", "receipt"]).notNull(),
    subjectRef: varchar("subject_ref", { length: 80 }).notNull(),
    rule: varchar("rule", { length: 40 }).notNull(),
    severity: mysqlEnum("severity", ["low", "medium", "high"]).notNull(),
    windowKey: varchar("window_key", { length: 40 }).notNull().default("all"),
    summary: varchar("summary", { length: 240 }).notNull(),
    details: jsonColumn<Record<string, unknown>>("details"),
    status: mysqlEnum("status", ["open", "confirmed", "dismissed"]).notNull().default("open"),
    reviewedBy: referenceColumn("reviewed_by"),
    reviewedAt: datetime("reviewed_at"),
    note: text("note"),
    createdAt: createdAtColumn(),
  },
  (table) => [uniqueIndex("fraud_flags_subject_idx").on(table.subjectType, table.subjectRef, table.rule, table.windowKey), index("fraud_flags_status_idx").on(table.status, table.createdAt)],
);

/** Promotions an admin runs: discount codes, extra free access and featured placement. Redemption is counted, never inferred. */
export const campaigns = mysqlTable(
  "campaigns",
  {
    id: idColumn().primaryKey(),
    name: varchar("name", { length: 120 }).notNull(),
    kind: mysqlEnum("kind", ["discount", "free_access", "featured"]).notNull(),
    code: varchar("code", { length: 40 }),
    percentOffBp: int("percent_off_bp").notNull().default(0),
    extraFreePerPillar: int("extra_free_per_pillar").notNull().default(0),
    startsAt: datetime("starts_at").notNull(),
    endsAt: datetime("ends_at").notNull(),
    maxRedemptions: int("max_redemptions"),
    redemptions: int("redemptions").notNull().default(0),
    status: mysqlEnum("status", ["draft", "active", "paused", "ended"]).notNull().default("draft"),
    notes: text("notes"),
    createdBy: referenceColumn("created_by"),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => [uniqueIndex("campaigns_code_idx").on(table.code), index("campaigns_status_idx").on(table.status, table.endsAt)],
);
