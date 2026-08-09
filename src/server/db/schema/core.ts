import {
  boolean,
  datetime,
  float,
  int,
  mysqlEnum,
  mysqlTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

import { createdAtColumn, idColumn, updatedAtColumn } from "./columns";

export const organizations = mysqlTable(
  "organizations",
  {
    id: idColumn().primaryKey(),
    name: varchar("name", { length: 160 }).notNull(),
    slug: varchar("slug", { length: 120 }).notNull(),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => [uniqueIndex("organizations_slug_idx").on(table.slug)],
);

export const users = mysqlTable(
  "users",
  {
    id: idColumn().primaryKey(),
    organizationId: idColumn("organization_id").references(() => organizations.id, {
      onDelete: "set null",
    }),
    email: varchar("email", { length: 254 }).notNull(),
    displayName: varchar("display_name", { length: 160 }).notNull(),
    status: mysqlEnum("status", ["invited", "active", "suspended"])
      .notNull()
      .default("active"),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => [uniqueIndex("users_email_idx").on(table.email)],
);

export const userSessions = mysqlTable(
  "user_sessions",
  {
    id: idColumn().primaryKey(),
    userId: idColumn("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 128 }).notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    lastSeenAt: timestamp("last_seen_at").notNull().defaultNow(),
    revokedAt: datetime("revoked_at"),
    createdAt: createdAtColumn(),
  },
  (table) => [uniqueIndex("user_sessions_token_hash_idx").on(table.tokenHash)],
);

export const userRoles = mysqlTable(
  "user_roles",
  {
    userId: idColumn("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 64 }).notNull(),
    grantedAt: timestamp("granted_at").notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.role] })],
);

export const learnerProfiles = mysqlTable("learner_profiles", {
  userId: idColumn("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  currentRole: varchar("current_role", { length: 160 }),
  industry: varchar("industry", { length: 120 }),
  experienceYears: int("experience_years"),
  weeklyMinutes: int("weekly_minutes"),
  timezone: varchar("timezone", { length: 64 }).notNull().default("Asia/Kolkata"),
  onboardingCompletedAt: datetime("onboarding_completed_at"),
  updatedAt: updatedAtColumn(),
});

export const skills = mysqlTable(
  "skills",
  {
    id: idColumn().primaryKey(),
    parentSkillId: idColumn("parent_skill_id"),
    name: varchar("name", { length: 160 }).notNull(),
    slug: varchar("slug", { length: 160 }).notNull(),
    description: text("description").notNull(),
    category: varchar("category", { length: 100 }).notNull(),
    type: varchar("type", { length: 80 }).notNull(),
    version: int("version").notNull().default(1),
    status: mysqlEnum("status", ["draft", "active", "retired"])
      .notNull()
      .default("draft"),
    createdAt: createdAtColumn(),
    updatedAt: updatedAtColumn(),
  },
  (table) => [uniqueIndex("skills_slug_version_idx").on(table.slug, table.version)],
);

export const skillRelationships = mysqlTable(
  "skill_relationships",
  {
    sourceSkillId: idColumn("source_skill_id")
      .notNull()
      .references(() => skills.id, { onDelete: "cascade" }),
    targetSkillId: idColumn("target_skill_id")
      .notNull()
      .references(() => skills.id, { onDelete: "cascade" }),
    relationshipType: mysqlEnum("relationship_type", ["parent", "prerequisite", "adjacent"]).notNull(),
    weight: float("weight").notNull().default(1),
  },
  (table) => [
    primaryKey({
      name: "skill_relationships_pk",
      columns: [table.sourceSkillId, table.targetSkillId, table.relationshipType],
    }),
  ],
);

export const roles = mysqlTable(
  "roles",
  {
    id: idColumn().primaryKey(),
    title: varchar("title", { length: 160 }).notNull(),
    slug: varchar("slug", { length: 160 }).notNull(),
    function: varchar("function", { length: 120 }),
    industry: varchar("industry", { length: 120 }),
    description: text("description").notNull(),
    createdAt: createdAtColumn(),
  },
  (table) => [uniqueIndex("roles_slug_idx").on(table.slug)],
);

export const roleSkills = mysqlTable(
  "role_skills",
  {
    roleId: idColumn("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    skillId: idColumn("skill_id")
      .notNull()
      .references(() => skills.id, { onDelete: "cascade" }),
    targetLevel: float("target_level").notNull(),
    required: boolean("required").notNull().default(true),
  },
  (table) => [primaryKey({ columns: [table.roleId, table.skillId] })],
);

export const learnerSkills = mysqlTable(
  "learner_skills",
  {
    learnerId: idColumn("learner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    skillId: idColumn("skill_id")
      .notNull()
      .references(() => skills.id, { onDelete: "cascade" }),
    currentLevel: float("current_level").notNull().default(0),
    targetLevel: float("target_level").notNull().default(0),
    confidence: float("confidence").notNull().default(0),
    evidenceCount: int("evidence_count").notNull().default(0),
    lastAssessedAt: datetime("last_assessed_at"),
    updatedAt: updatedAtColumn(),
  },
  (table) => [primaryKey({ columns: [table.learnerId, table.skillId] })],
);
