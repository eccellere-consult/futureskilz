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
  NOTIFICATION_PROVIDER: z.enum(["console"]).default("console"),
  SESSION_SECRET: z.string().min(32).optional(),
  MAGIC_LINK_SECRET: z.string().min(32).optional(),
});

export type ServerEnvironment = z.infer<typeof serverEnvironmentSchema>;

let cachedEnvironment: ServerEnvironment | undefined;

export function getServerEnvironment(): ServerEnvironment {
  cachedEnvironment ??= serverEnvironmentSchema.parse(process.env);
  return cachedEnvironment;
}
