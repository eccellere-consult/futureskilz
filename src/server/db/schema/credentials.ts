import { datetime, int, mysqlTable, varchar } from "drizzle-orm/mysql-core";

import { createdAtColumn, referenceColumn, updatedAtColumn } from "./columns";
import { users } from "./core";

/**
 * Optional password for an account. Most people sign in with an emailed link and never have a row here. An admin can give an
 * account a password (for test users and staff); only a salted scrypt hash is stored, never the password, and repeated wrong
 * guesses lock the row for a while.
 */
export const userCredentials = mysqlTable("user_credentials", {
  userId: referenceColumn("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  failedAttempts: int("failed_attempts").notNull().default(0),
  lockedUntil: datetime("locked_until"),
  /** Who set it, so a password an admin chose is always traceable. */
  setBy: referenceColumn("set_by"),
  createdAt: createdAtColumn(),
  updatedAt: updatedAtColumn(),
});
