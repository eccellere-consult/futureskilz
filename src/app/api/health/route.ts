/**
 * GET /api/health — what the site needs to sign people in and save their work, checked step by step, in plain words:
 * the settings it reads, the database connection, the self-setup of its tables, and the mailbox that sends sign-in links.
 *
 * It reports only yes/no for each setting and error CODES with a plain explanation: never a password, key, user name,
 * database name or host. The result is cached for a minute, so the page cannot be used to hammer the database or the
 * mail server.
 */
import { NextResponse } from "next/server";

import { getMysqlPool } from "@/lib/mysql";
import { SchemaStepError, ensureDatabaseSchema } from "@/server/db/ensure-schema";
import { getServerEnvironment } from "@/server/env";
import { SmtpEmailProvider } from "@/server/providers/smtp";

export const dynamic = "force-dynamic";

type Check = { ok: boolean; detail: string };

const DATABASE_HINTS: Record<string, string> = {
  ER_ACCESS_DENIED_ERROR: "the database refused the user name or password (check MYSQL_USER and MYSQL_PASSWORD)",
  ER_DBACCESS_DENIED_ERROR: "the database user is not allowed to use this database (check MYSQL_DATABASE and the user's access in hPanel)",
  ER_BAD_DB_ERROR: "there is no database with that name (check MYSQL_DATABASE)",
  ECONNREFUSED: "the database server refused the connection (check MYSQL_HOST and MYSQL_PORT)",
  ENOTFOUND: "the database server name was not found (check MYSQL_HOST)",
  ETIMEDOUT: "the database server did not answer in time (check MYSQL_HOST)",
  ER_TABLEACCESS_DENIED_ERROR: "the database user is not allowed to create or change tables",
  ER_CANT_CREATE_TABLE: "a table could not be created, usually because a link between two tables did not match",
  ER_CANNOT_ADD_FOREIGN: "a link between two tables could not be made (their text columns use different character sets)",
};

const EMAIL_HINTS: Record<string, string> = {
  EAUTH: "the mail server refused the login (check SMTP_USER is the full address and SMTP_PASSWORD is the mailbox password)",
  ECONNECTION: "the mail server could not be reached (check SMTP_HOST and SMTP_PORT)",
  ETIMEDOUT: "the mail server did not answer in time (check SMTP_HOST and SMTP_PORT)",
  ESOCKET: "the secure connection to the mail server failed (check SMTP_PORT is 465)",
  EDNS: "the mail server name was not found (check SMTP_HOST)",
};

function codeOf(error: unknown): string {
  const e = (error instanceof SchemaStepError ? error.cause : error) as { code?: unknown; errno?: unknown } | undefined;
  return typeof e?.code === "string" ? e.code : typeof e?.errno === "number" ? `errno ${e.errno}` : "unknown";
}

const explain = (code: string, hints: Record<string, string>) => hints[code] ?? `an unexpected error (${code})`;

async function runChecks() {
  const env = getServerEnvironment();
  // Read the raw settings, so a value filled in by a default (MYSQL_HOST, SMTP_HOST) still shows as "not set".
  const isSet = (name: string) => Boolean(process.env[name]?.trim());
  const settings = {
    MYSQL_HOST: isSet("MYSQL_HOST"),
    MYSQL_USER: isSet("MYSQL_USER"),
    MYSQL_PASSWORD: isSet("MYSQL_PASSWORD"),
    MYSQL_DATABASE: isSet("MYSQL_DATABASE"),
    SESSION_SECRET: isSet("SESSION_SECRET"),
    MAGIC_LINK_SECRET: isSet("MAGIC_LINK_SECRET"),
    NOTIFICATION_PROVIDER: env.NOTIFICATION_PROVIDER,
    SMTP_HOST: isSet("SMTP_HOST"),
    SMTP_USER: isSet("SMTP_USER"),
    SMTP_PASSWORD: isSet("SMTP_PASSWORD"),
    EMAIL_FROM: isSet("EMAIL_FROM"),
    APP_URL: env.APP_URL,
    AI_PROVIDER: env.AI_PROVIDER,
  };

  let database: Check;
  if (!env.MYSQL_USER || !env.MYSQL_DATABASE) {
    database = { ok: false, detail: "not set up: MYSQL_USER and MYSQL_DATABASE are needed in the server settings" };
  } else {
    try {
      await getMysqlPool().query("SELECT 1");
      database = { ok: true, detail: "connected" };
    } catch (error) {
      const code = codeOf(error);
      database = { ok: false, detail: `${explain(code, DATABASE_HINTS)} [${code}]` };
    }
  }

  let tables: Check = { ok: false, detail: "not checked, because the database is not connected" };
  if (database.ok) {
    try {
      await ensureDatabaseSchema();
      tables = { ok: true, detail: "all tables are in place" };
    } catch (error) {
      const code = codeOf(error);
      const step = error instanceof SchemaStepError ? error.step : "the self-setup";
      tables = { ok: false, detail: `stopped while ${step}: ${explain(code, DATABASE_HINTS)} [${code}]` };
    }
  }

  let email: Check;
  if (env.NOTIFICATION_PROVIDER !== "smtp") {
    email = { ok: false, detail: "NOTIFICATION_PROVIDER is not \"smtp\", so sign-in links are only written to the server log, not emailed" };
  } else if (!env.SMTP_USER || !env.SMTP_PASSWORD || !env.EMAIL_FROM) {
    email = { ok: false, detail: "SMTP_USER, SMTP_PASSWORD and EMAIL_FROM are all needed in the server settings" };
  } else {
    try {
      await new SmtpEmailProvider({ host: env.SMTP_HOST, port: env.SMTP_PORT, user: env.SMTP_USER, password: env.SMTP_PASSWORD, from: env.EMAIL_FROM }).verify();
      email = { ok: true, detail: `signed in to the mailbox on port ${env.SMTP_PORT}` };
    } catch (error) {
      const code = codeOf(error);
      email = { ok: false, detail: `${explain(code, EMAIL_HINTS)} [${code}]` };
    }
  }

  const signIn = Boolean(settings.SESSION_SECRET && settings.MAGIC_LINK_SECRET && database.ok && tables.ok && email.ok);
  return { signInReady: signIn, build: { id: process.env.NEXT_PUBLIC_BUILD_ID ?? "unknown", builtAt: process.env.NEXT_PUBLIC_BUILT_AT ?? "unknown" }, settings, database, tables, email, checkedAt: new Date().toISOString() };
}

let cached: { at: number; result: Promise<Awaited<ReturnType<typeof runChecks>>> } | null = null;

export async function GET() {
  if (!cached || Date.now() - cached.at > 60_000) cached = { at: Date.now(), result: runChecks() };
  try {
    return NextResponse.json(await cached.result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    cached = null;
    console.error("[health]", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "The health check itself failed. Please try again." }, { status: 500 });
  }
}
