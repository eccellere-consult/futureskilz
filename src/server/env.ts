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
  /** Comma-separated addresses that become admins the first time they sign in (the owner, so there is someone to create the rest). */
  BOOTSTRAP_ADMIN_EMAILS: z.string().optional(),
  DEMO_ACCESS_CODE: z.string().min(12).optional(),
  /** "auto" gives Arya a studio-quality voice through OpenAI when a key is set; "browser" always uses the visitor's own device voice. */
  /** "off" sells nothing and locks nothing; "test" lets an admin simulate a payment (never for real money); "razorpay" takes real payments. */
  PAYMENTS_MODE: z.enum(["off", "test", "razorpay"]).default("off"),
  RAZORPAY_KEY_ID: z.string().min(1).optional(),
  RAZORPAY_KEY_SECRET: z.string().min(1).optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().min(8).optional(),
  /** GST on invoices: the supplier's legal name, GSTIN, state code (for example "29"), and the rate in basis points (1800 = 18%). */
  GST_SUPPLIER_NAME: z.string().min(1).optional(),
  GST_SUPPLIER_GSTIN: z.string().min(1).optional(),
  GST_SUPPLIER_STATE: z.string().regex(/^\d{2}$/).optional(),
  GST_SUPPLIER_ADDRESS: z.string().min(1).optional(),
  GST_RATE_BP: z.coerce.number().int().min(0).max(2800).default(1800),
  ARYA_VOICE: z.enum(["auto", "browser"]).default("auto"),
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
