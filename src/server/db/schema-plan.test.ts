import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { additiveColumns, chooseSchemaPlan } from "./schema-plan";

describe("chooseSchemaPlan", () => {
  it("runs the migrations only on an empty database", () => {
    expect(chooseSchemaPlan({ hasUsersTable: false, hasMigrationsFolder: true })).toBe("migrate");
    expect(chooseSchemaPlan({ hasUsersTable: true, hasMigrationsFolder: true })).toBe("add-columns");
    expect(chooseSchemaPlan({ hasUsersTable: false, hasMigrationsFolder: false })).toBe("add-columns");
  });
});

describe("additiveColumns", () => {
  it("matches every column the 0001 migration adds", () => {
    const sql = readFileSync(path.join(process.cwd(), "drizzle", "0001_accounts_and_saved_progress.sql"), "utf8");
    const fromMigration = [...sql.matchAll(/ALTER TABLE `(\w+)` ADD `(\w+)` ([^;]+);/g)].map(([, table, column, definition]) => ({
      table,
      column,
      definition: definition.trim(),
    }));
    expect(additiveColumns).toEqual(fromMigration);
  });
});
