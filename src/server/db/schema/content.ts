import { float, mysqlEnum, mysqlTable, text, varchar } from "drizzle-orm/mysql-core";

import { idColumn, createdAtColumn, referenceColumn, jsonColumn } from "./columns";
import { skills, users } from "./core";
import { skillShots } from "./learning";

export const sourceAssets = mysqlTable("source_assets", {
  id: idColumn().primaryKey(),
  contributorId: referenceColumn("contributor_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  storageKey: varchar("storage_key", { length: 512 }).notNull(),
  filename: varchar("filename", { length: 255 }).notNull(),
  mediaType: varchar("media_type", { length: 120 }).notNull(),
  checksum: varchar("checksum", { length: 128 }).notNull(),
  status: mysqlEnum("status", ["uploaded", "processing", "review", "approved", "rejected", "published"]).notNull().default("uploaded"),
  createdAt: createdAtColumn(),
});

export const contentExtractions = mysqlTable("content_extractions", {
  id: idColumn().primaryKey(),
  sourceAssetId: referenceColumn("source_asset_id").notNull().references(() => sourceAssets.id, { onDelete: "cascade" }),
  skillId: referenceColumn("skill_id").references(() => skills.id, { onDelete: "set null" }),
  extraction: jsonColumn<Record<string, unknown>>("extraction").notNull(),
  model: varchar("model", { length: 120 }).notNull(),
  promptVersion: varchar("prompt_version", { length: 64 }).notNull(),
  confidence: float("confidence").notNull(),
  createdAt: createdAtColumn(),
});

export const contentProvenance = mysqlTable("content_provenance", {
  id: idColumn().primaryKey(),
  skillShotId: referenceColumn("skill_shot_id").notNull().references(() => skillShots.id, { onDelete: "cascade" }),
  sourceAssetId: referenceColumn("source_asset_id").notNull().references(() => sourceAssets.id, { onDelete: "restrict" }),
  extractionId: referenceColumn("extraction_id").references(() => contentExtractions.id, { onDelete: "set null" }),
  attribution: text("attribution").notNull(),
  createdAt: createdAtColumn(),
});

export const contentReviews = mysqlTable("content_reviews", {
  id: idColumn().primaryKey(),
  skillShotId: referenceColumn("skill_shot_id").notNull().references(() => skillShots.id, { onDelete: "cascade" }),
  reviewerId: referenceColumn("reviewer_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  decision: varchar("decision", { length: 64 }).notNull(),
  checklist: jsonColumn<Record<string, unknown>>("checklist").notNull(),
  notes: text("notes"),
  createdAt: createdAtColumn(),
});
