import { boolean, datetime, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

import { createdAtColumn, idColumn, updatedAtColumn, referenceColumn, jsonColumn } from "./columns";
import { organizations, users } from "./core";

export const aiConversations = mysqlTable("ai_conversations", {
  id: idColumn().primaryKey(),
  userId: referenceColumn("user_id").references(() => users.id, { onDelete: "set null" }),
  channel: varchar("channel", { length: 32 }).notNull(),
  context: jsonColumn<Record<string, unknown>>("context").notNull(),
  createdAt: createdAtColumn(),
  updatedAt: updatedAtColumn(),
});

export const agentRuns = mysqlTable("agent_runs", {
  id: idColumn().primaryKey(),
  conversationId: referenceColumn("conversation_id").references(() => aiConversations.id, { onDelete: "set null" }),
  agentName: varchar("agent_name", { length: 120 }).notNull(),
  agentVersion: varchar("agent_version", { length: 64 }).notNull(),
  provider: varchar("provider", { length: 64 }).notNull(),
  model: varchar("model", { length: 120 }).notNull(),
  status: mysqlEnum("status", ["started", "succeeded", "failed", "escalated"]).notNull().default("started"),
  input: jsonColumn<Record<string, unknown>>("input").notNull(),
  output: jsonColumn<Record<string, unknown>>("output"),
  error: text("error"),
  inputTokens: int("input_tokens"),
  outputTokens: int("output_tokens"),
  costMicros: int("cost_micros").notNull().default(0),
  latencyMs: int("latency_ms"),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  completedAt: datetime("completed_at"),
});

export const agentDecisions = mysqlTable("agent_decisions", {
  id: idColumn().primaryKey(),
  runId: referenceColumn("run_id").notNull().references(() => agentRuns.id, { onDelete: "cascade" }),
  decision: varchar("decision", { length: 160 }).notNull(),
  rationale: text("rationale").notNull(),
  confidence: varchar("confidence", { length: 32 }).notNull(),
  requiresApproval: boolean("requires_approval").notNull().default(false),
  createdAt: createdAtColumn(),
});

export const auditLogs = mysqlTable("audit_logs", {
  id: idColumn().primaryKey(),
  organizationId: referenceColumn("organization_id").references(() => organizations.id, { onDelete: "set null" }),
  actorId: referenceColumn("actor_id").references(() => users.id, { onDelete: "set null" }),
  action: varchar("action", { length: 120 }).notNull(),
  resourceType: varchar("resource_type", { length: 120 }).notNull(),
  resourceId: varchar("resource_id", { length: 160 }),
  metadata: jsonColumn<Record<string, unknown>>("metadata").notNull(),
  createdAt: createdAtColumn(),
});

export const notificationConsent = mysqlTable("notification_consent", {
  id: idColumn().primaryKey(),
  userId: referenceColumn("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  channel: mysqlEnum("channel", ["whatsapp", "email", "web_push"]).notNull(),
  destination: varchar("destination", { length: 254 }).notNull(),
  consentedAt: timestamp("consented_at").notNull(),
  source: varchar("source", { length: 120 }).notNull(),
  optedOutAt: datetime("opted_out_at"),
});

export const notificationOutbox = mysqlTable("notification_outbox", {
  id: idColumn().primaryKey(),
  userId: referenceColumn("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  channel: mysqlEnum("channel", ["whatsapp", "email", "web_push"]).notNull(),
  templateKey: varchar("template_key", { length: 160 }).notNull(),
  payload: jsonColumn<Record<string, unknown>>("payload").notNull(),
  idempotencyKey: varchar("idempotency_key", { length: 190 }).notNull().unique(),
  status: mysqlEnum("status", ["pending", "processing", "sent", "failed", "cancelled"]).notNull().default("pending"),
  attempts: int("attempts").notNull().default(0),
  scheduledFor: timestamp("scheduled_for").notNull(),
  sentAt: datetime("sent_at"),
  lastError: text("last_error"),
  createdAt: createdAtColumn(),
});

export const magicLinks = mysqlTable("magic_links", {
  id: idColumn().primaryKey(),
  userId: referenceColumn("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: varchar("token_hash", { length: 128 }).notNull().unique(),
  resourceType: varchar("resource_type", { length: 80 }).notNull(),
  resourceId: varchar("resource_id", { length: 160 }).notNull(),
  payload: jsonColumn<Record<string, unknown>>("payload"),
  expiresAt: timestamp("expires_at").notNull(),
  consumedAt: datetime("consumed_at"),
  createdAt: createdAtColumn(),
});

export const pushSubscriptions = mysqlTable("push_subscriptions", {
  id: idColumn().primaryKey(),
  userId: referenceColumn("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  endpoint: varchar("endpoint", { length: 1024 }).notNull().unique(),
  publicKey: varchar("public_key", { length: 255 }).notNull(),
  authSecret: varchar("auth_secret", { length: 255 }).notNull(),
  createdAt: createdAtColumn(),
  revokedAt: datetime("revoked_at"),
});
