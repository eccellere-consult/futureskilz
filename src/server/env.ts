import "server-only";

import { z } from "zod";

const serverEnvironmentSchema = z.object({
  MYSQL_HOST: z.string().min(1).default("127.0.0.1"),
  MYSQL_PORT: z.coerce.number().int().positive().default(3306),
  MYSQL_USER: z.string().min(1).optional(),
  MYSQL_PASSWORD: z.string().default(""),
  MYSQL_DATABASE: z.string().min(1).optional(),
  MYSQL_CONNECTION_LIMIT: z.coerce.number().int().positive().default(10),
  AI_PROVIDER: z.enum(["auto", "deterministic", "openai", "xai"]).default("deterministic"),
  OPENAI_API_KEY: z.string().min(1).optional(),
  XAI_API_KEY: z.string().min(1).optional(),
  STORAGE_PROVIDER: z.enum(["local"]).default("local"),
  NOTIFICATION_PROVIDER: z.enum(["console", "smtp"]).default("console"),
  SMTP_HOST: z.string().min(1).default("smtp.hostinger.com"),
  SMTP_PORT: z.coerce.number().int().positive().default(465),
  SMTP_USER: z.string().min(1).optional(),
  SMTP_PASSWORD: z.string().min(1).optional(),
  EMAIL_FROM: z.string().min(3).optional(),
  APP_URL: z.url().default("http://localhost:3000"),
  SESSION_SECRET: z.string().min(32).optional(),
  MAGIC_LINK_SECRET: z.string().min(32).optional(),
  /** Turns on the /demo page. Leave unset in a live launch; set it to a long random phrase only while demonstrating. */
  DEMO_ACCESS_CODE: z.string().min(12).optional(),
});

export type ServerEnvironment = z.infer<typeof serverEnvironmentSchema>;

let cachedEnvironment: ServerEnvironment | undefined;

/** An empty `KEY=` line means "not set", as `.env.example` and hPanel both produce them. */
export function parseServerEnvironment(source: Record<string, string | undefined>): ServerEnvironment {
  const provided = Object.fromEntries(Object.entries(source).filter(([, value]) => value !== undefined && value.trim() !== ""));
  return serverEnvironmentSchema.parse(provided);
}

export function getServerEnvironment(): ServerEnvironment {
  cachedEnvironment ??= parseServerEnvironment(process.env);
  return cachedEnvironment;
}
