import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { additiveColumns, additiveTables, chooseSchemaPlan } from "./schema-plan";

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

describe("additiveTables", () => {
  it("are word for word the statements of the 0002 migration, grouped by table", () => {
    const sql = readFileSync(path.join(process.cwd(), "drizzle", "0002_framework_workspace.sql"), "utf8");
    const statements = sql.split("--> statement-breakpoint").map((s) => s.trim()).filter(Boolean);
    const tableOf = (statement: string) => /(?:CREATE TABLE|ALTER TABLE|ON) `(\w+)`/.exec(statement)?.[1];
    const grouped = new Map<string, string[]>();
    for (const statement of statements) {
      const table = tableOf(statement);
      expect(table, statement).toBeTruthy();
      grouped.set(table!, [...(grouped.get(table!) ?? []), statement]);
    }
    expect(additiveTables.map(({ table, statements: s }) => [table, [...s]])).toEqual([...grouped.entries()]);
  });

  it("create each table before its foreign keys and indexes", () => {
    for (const { table, statements } of additiveTables) expect(statements[0]).toMatch(new RegExp(`^CREATE TABLE \`${table}\``));
  });
});
