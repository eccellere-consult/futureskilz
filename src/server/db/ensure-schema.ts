import "server-only";

import { existsSync } from "node:fs";
import path from "node:path";

import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";

import { getMysqlPool } from "@/lib/mysql";

import { additiveColumns, additiveTables, chooseSchemaPlan } from "./schema-plan";

const lockName = "futureskilz_schema";
let schemaPromise: Promise<void> | undefined;

/**
 * Hostinger offers no shell, so the site brings its own database up to date on first use
 * (approved by the owner on 2026-10-18). Every step only adds tables or columns, and a named
 * lock keeps two processes from racing.
 */
export function ensureDatabaseSchema(): Promise<void> {
  schemaPromise ??= runSchemaSteps().catch((error: unknown) => {
    schemaPromise = undefined;
    throw error;
  });
  return schemaPromise;
}

async function tableExists(connection: PoolConnection, table: string): Promise<boolean> {
  const [rows] = await connection.query<RowDataPacket[]>(
    "SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ? LIMIT 1",
    [table],
  );
  return rows.length > 0;
}

/** A failed self-setup step, named so the health check can say where it stopped (the database error stays as `cause`). */
export class SchemaStepError extends Error {
  constructor(public step: string, cause: unknown) {
    super(`Database self-setup stopped at: ${step}.`, { cause });
    this.name = "SchemaStepError";
  }
}

async function runSchemaSteps(): Promise<void> {
  let step = "connecting to the database";
  try {
    await runSchemaStepsTracked((next) => { step = next; });
  } catch (error) {
    throw error instanceof SchemaStepError ? error : new SchemaStepError(step, error);
  }
}

async function runSchemaStepsTracked(at: (step: string) => void): Promise<void> {
  const connection = await getMysqlPool().getConnection();
  at("taking the schema lock");
  try {
    const [locked] = await connection.query<RowDataPacket[]>("SELECT GET_LOCK(?, 30) AS acquired", [lockName]);
    if (Number(locked[0]?.acquired) !== 1) throw new Error("Timed out waiting for the database schema lock.");

    try {
      at("checking which tables exist");
      const migrationsFolder = path.join(process.cwd(), "drizzle");
      const plan = chooseSchemaPlan({
        hasUsersTable: await tableExists(connection, "users"),
        hasMigrationsFolder: existsSync(path.join(migrationsFolder, "meta", "_journal.json")),
      });

      if (plan === "migrate") {
        at("running the migrations on an empty database");
        await migrate(drizzle({ client: connection }), { migrationsFolder });
        console.info("Database schema is up to date (migrations).");
        return;
      }

      for (const { table, statements } of additiveTables) {
        if (await tableExists(connection, table)) continue;
        at(`creating the ${table} table`);
        for (const statement of statements) await connection.query(statement);
        console.info(`Database schema: created ${table}.`);
      }

      for (const { table, column, definition } of additiveColumns) {
        const [present] = await connection.query<RowDataPacket[]>(
          "SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ? LIMIT 1",
          [table, column],
        );
        if (present.length === 0) {
          at(`adding ${table}.${column}`);
          await connection.query(`ALTER TABLE \`${table}\` ADD \`${column}\` ${definition}`);
          console.info(`Database schema: added ${table}.${column}.`);
        }
      }
    } finally {
      await connection.query("SELECT RELEASE_LOCK(?)", [lockName]);
    }
  } finally {
    connection.release();
  }
}
