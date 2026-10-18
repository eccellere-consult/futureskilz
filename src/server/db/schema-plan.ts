/**
 * Columns added after the first migration (drizzle/0001), added one by one when missing.
 * Keep this list in step with every later additive migration.
 */
export const additiveColumns = [
  { table: "learner_profiles", column: "responsibility_level", definition: "varchar(32)" },
  { table: "learner_profiles", column: "focus", definition: "varchar(64)" },
  { table: "learner_profiles", column: "horizon", definition: "varchar(32)" },
  { table: "learner_profiles", column: "challenge_type", definition: "varchar(64)" },
  { table: "learner_profiles", column: "challenge", definition: "text" },
  { table: "learner_profiles", column: "priority_families", definition: "json" },
  { table: "learner_profiles", column: "welcome_summary", definition: "text" },
  { table: "learner_profiles", column: "welcome_summary_source", definition: "varchar(16)" },
  { table: "magic_links", column: "payload", definition: "json" },
] as const;

export type SchemaPlan = "migrate" | "add-columns";

/**
 * An empty database gets every checked-in migration. A database that already has tables only
 * gets the columns it is missing: re-running a migration there could fail on columns someone
 * already added by hand, whether or not Drizzle's migration record exists.
 */
export function chooseSchemaPlan(state: { hasUsersTable: boolean; hasMigrationsFolder: boolean }): SchemaPlan {
  return !state.hasUsersTable && state.hasMigrationsFolder ? "migrate" : "add-columns";
}
