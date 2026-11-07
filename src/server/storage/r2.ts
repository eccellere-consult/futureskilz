import "server-only";

import { randomUUID } from "node:crypto";

import { objectPath, presignUrl, signHeaders } from "./s3-sign";

/**
 * The file store: a private Cloudflare R2 bucket. Browsers send big files straight to it with a short-lived presigned
 * link, so the website's own server (and Hostinger's request limits) never carry them. The secret key stays here.
 *
 * Settings (Hostinger > Node.js > Environment variables): R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY.
 * With any of them missing, `r2Config()` is null and the site falls back to ordinary uploads of up to 25 MB.
 */
export type R2Config = { accountId: string; bucket: string; accessKeyId: string; secretAccessKey: string };

export function r2Config(env: Record<string, string | undefined> = process.env): R2Config | null {
  const accountId = env.R2_ACCOUNT_ID?.trim();
  const bucket = env.R2_BUCKET?.trim();
  const accessKeyId = env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY?.trim();
  return accountId && bucket && accessKeyId && secretAccessKey ? { accountId, bucket, accessKeyId, secretAccessKey } : null;
}

export const R2_SETTING_NAMES = ["R2_ACCOUNT_ID", "R2_BUCKET", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"] as const;

const hostOf = (config: R2Config) => `${config.accountId}.r2.cloudflarestorage.com`;
const REGION = "auto";

/** The largest single file the browser may send. R2 takes up to 5 GB in one request. */
export const MAX_STORED_BYTES = 5 * 1024 * 1024 * 1024;

/** A key that cannot collide and carries no path tricks: folder per project, a random id, then a safe file name. */
export function storageKeyFor(projectId: string, filename: string): string {
  const safe = filename.replace(/[\\/\u0000-\u001f]/g, "_").replace(/\.{2,}/g, ".").replace(/\s+/g, " ").trim().slice(0, 150) || "file";
  return `kc/${projectId}/${randomUUID()}/${safe}`;
}

/** A key must belong to this project: this is what stops one project from claiming another project's file. */
export const keyBelongsTo = (key: string, projectId: string): boolean => key.startsWith(`kc/${projectId}/`) && !key.split("/").includes("..");

export function presignedPut(config: R2Config, key: string, expiresIn = 1800): string {
  return presignUrl({ method: "PUT", host: hostOf(config), path: objectPath(config.bucket, key), region: REGION, accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey, expiresIn });
}

async function signedFetch(config: R2Config, method: "GET" | "HEAD" | "DELETE", key: string): Promise<Response> {
  const host = hostOf(config);
  const path = objectPath(config.bucket, key);
  return fetch(`https://${host}${path}`, { method, headers: signHeaders({ method, host, path, region: REGION, accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey }), signal: AbortSignal.timeout(50_000) });
}

/** Size and type of a stored file, or null when it is not there. */
export async function headObject(config: R2Config, key: string): Promise<{ size: number; contentType: string | null } | null> {
  const response = await signedFetch(config, "HEAD", key);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`The file store answered ${response.status}.`);
  return { size: Number(response.headers.get("content-length") ?? 0), contentType: response.headers.get("content-type") };
}

/** Reads a whole stored file into memory. Callers check the size first with `headObject`. */
export async function getObjectBytes(config: R2Config, key: string): Promise<Buffer> {
  const response = await signedFetch(config, "GET", key);
  if (!response.ok) throw new Error(`The file store answered ${response.status}.`);
  return Buffer.from(await response.arrayBuffer());
}

export async function deleteObject(config: R2Config, key: string): Promise<void> {
  const response = await signedFetch(config, "DELETE", key);
  if (!response.ok && response.status !== 404) throw new Error(`The file store answered ${response.status}.`);
}
