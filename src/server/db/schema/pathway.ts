import { mysqlTable, varchar } from "drizzle-orm/mysql-core";

import { createdAtColumn, referenceColumn, updatedAtColumn } from "./columns";
import { users } from "./core";

/**
 * The role a learner is working toward, by the slug of a seeded role (src/features/pathway/roles.ts).
 * One row per learner. Roles live in code for now, so the slug is not a foreign key; an unknown slug is simply ignored on read.
 */
export const learnerPathway = mysqlTable("learner_pathway", {
  userId: referenceColumn("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  targetRole: varchar("target_role", { length: 60 }).notNull(),
  createdAt: createdAtColumn(),
  updatedAt: updatedAtColumn(),
});
