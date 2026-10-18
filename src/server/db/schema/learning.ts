import {
  datetime,
  float,
  int,
  mysqlEnum,
  mysqlTable,
  primaryKey,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

import { roles, skills, users } from "./core";
import { createdAtColumn, idColumn, updatedAtColumn, referenceColumn, jsonColumn } from "./columns";

export const goals = mysqlTable("goals", {
  id: idColumn().primaryKey(),
  learnerId: referenceColumn("learner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  targetRoleId: referenceColumn("target_role_id").references(() => roles.id, { onDelete: "set null" }),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description").notNull(),
  targetDate: datetime("target_date"),
  priority: int("priority").notNull().default(1),
  status: mysqlEnum("status", ["draft", "active", "completed", "archived"]).notNull().default("active"),
  createdAt: createdAtColumn(),
  updatedAt: updatedAtColumn(),
});

export const goalSkills = mysqlTable(
  "goal_skills",
  {
    goalId: referenceColumn("goal_id").notNull().references(() => goals.id, { onDelete: "cascade" }),
    skillId: referenceColumn("skill_id").notNull().references(() => skills.id, { onDelete: "cascade" }),
    targetLevel: float("target_level").notNull(),
    priority: int("priority").notNull().default(1),
  },
  (table) => [primaryKey({ columns: [table.goalId, table.skillId] })],
);

export const learningJourneys = mysqlTable("learning_journeys", {
  id: idColumn().primaryKey(),
  learnerId: referenceColumn("learner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  goalId: referenceColumn("goal_id").notNull().references(() => goals.id, { onDelete: "cascade" }),
  estimatedMinutes: int("estimated_minutes").notNull(),
  progress: float("progress").notNull().default(0),
  status: mysqlEnum("status", ["draft", "active", "completed", "archived"]).notNull().default("active"),
  createdAt: createdAtColumn(),
  updatedAt: updatedAtColumn(),
});

export const skillShots = mysqlTable("skill_shots", {
  id: idColumn().primaryKey(),
  skillId: referenceColumn("skill_id").notNull().references(() => skills.id, { onDelete: "restrict" }),
  title: varchar("title", { length: 220 }).notNull(),
  slug: varchar("slug", { length: 190 }).notNull().unique(),
  learningObjective: text("learning_objective").notNull(),
  format: varchar("format", { length: 64 }).notNull(),
  durationMinutes: int("duration_minutes").notNull(),
  content: jsonColumn<Record<string, unknown>>("content").notNull(),
  provenanceSummary: text("provenance_summary"),
  status: mysqlEnum("status", ["draft", "active", "completed", "archived"]).notNull().default("draft"),
  publishedAt: datetime("published_at"),
  createdAt: createdAtColumn(),
  updatedAt: updatedAtColumn(),
});

export const journeySteps = mysqlTable("journey_steps", {
  id: idColumn().primaryKey(),
  journeyId: referenceColumn("journey_id").notNull().references(() => learningJourneys.id, { onDelete: "cascade" }),
  skillId: referenceColumn("skill_id").notNull().references(() => skills.id, { onDelete: "restrict" }),
  skillShotId: referenceColumn("skill_shot_id").references(() => skillShots.id, { onDelete: "set null" }),
  sequence: int("sequence").notNull(),
  status: mysqlEnum("status", ["draft", "active", "completed", "archived"]).notNull().default("draft"),
  score: float("score"),
  mastery: float("mastery"),
});

export const assessments = mysqlTable("assessments", {
  id: idColumn().primaryKey(),
  title: varchar("title", { length: 220 }).notNull(),
  type: varchar("type", { length: 64 }).notNull(),
  rubricVersion: varchar("rubric_version", { length: 64 }).notNull(),
  status: mysqlEnum("status", ["draft", "active", "completed", "archived"]).notNull().default("draft"),
  createdAt: createdAtColumn(),
});

export const assessmentQuestions = mysqlTable("assessment_questions", {
  id: idColumn().primaryKey(),
  assessmentId: referenceColumn("assessment_id").notNull().references(() => assessments.id, { onDelete: "cascade" }),
  skillId: referenceColumn("skill_id").notNull().references(() => skills.id, { onDelete: "restrict" }),
  sequence: int("sequence").notNull(),
  prompt: text("prompt").notNull(),
  responseType: varchar("response_type", { length: 64 }).notNull(),
  rubric: jsonColumn<Record<string, unknown>>("rubric").notNull(),
});

export const assessmentAttempts = mysqlTable("assessment_attempts", {
  id: idColumn().primaryKey(),
  assessmentId: referenceColumn("assessment_id").notNull().references(() => assessments.id, { onDelete: "restrict" }),
  learnerId: referenceColumn("learner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  status: mysqlEnum("status", ["started", "submitted", "evaluated", "abandoned"]).notNull().default("started"),
  score: float("score"),
  confidence: float("confidence"),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  completedAt: datetime("completed_at"),
});

export const assessmentResponses = mysqlTable("assessment_responses", {
  id: idColumn().primaryKey(),
  attemptId: referenceColumn("attempt_id").notNull().references(() => assessmentAttempts.id, { onDelete: "cascade" }),
  questionId: referenceColumn("question_id").notNull().references(() => assessmentQuestions.id, { onDelete: "restrict" }),
  response: jsonColumn<Record<string, unknown>>("response").notNull(),
  score: float("score"),
  evaluator: varchar("evaluator", { length: 120 }),
  confidence: float("confidence"),
  createdAt: createdAtColumn(),
});

export const skillEvidence = mysqlTable("skill_evidence", {
  id: idColumn().primaryKey(),
  learnerId: referenceColumn("learner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  skillId: referenceColumn("skill_id").notNull().references(() => skills.id, { onDelete: "restrict" }),
  evidenceType: varchar("evidence_type", { length: 64 }).notNull(),
  score: float("score").notNull(),
  source: varchar("source", { length: 160 }).notNull(),
  evaluator: varchar("evaluator", { length: 120 }).notNull(),
  confidence: float("confidence").notNull(),
  createdAt: createdAtColumn(),
});

export const skillShotAttempts = mysqlTable("skill_shot_attempts", {
  id: idColumn().primaryKey(),
  skillShotId: referenceColumn("skill_shot_id").notNull().references(() => skillShots.id, { onDelete: "restrict" }),
  learnerId: referenceColumn("learner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  status: mysqlEnum("status", ["started", "submitted", "evaluated", "abandoned"]).notNull().default("started"),
  progress: float("progress").notNull().default(0),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  completedAt: datetime("completed_at"),
});

export const practiceSessions = mysqlTable("practice_sessions", {
  id: idColumn().primaryKey(),
  learnerId: referenceColumn("learner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  skillId: referenceColumn("skill_id").notNull().references(() => skills.id, { onDelete: "restrict" }),
  skillShotId: referenceColumn("skill_shot_id").references(() => skillShots.id, { onDelete: "set null" }),
  response: jsonColumn<Record<string, unknown>>("response").notNull(),
  feedback: jsonColumn<Record<string, unknown>>("feedback"),
  score: float("score"),
  createdAt: createdAtColumn(),
});
