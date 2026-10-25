import "server-only";

import { NextResponse } from "next/server";

import { getSessionClient, type SessionClient } from "@/lib/auth";
import { isSameOrigin, readJson } from "@/server/http/request";

import { CaptureError } from "./shared";

const noStore = { "Cache-Control": "no-store" };

export const json = (body: unknown, status = 200): NextResponse => NextResponse.json(body, { status, headers: noStore });
export const failure = (status: number, error: string, extra?: Record<string, unknown>): NextResponse => NextResponse.json({ error, ...extra }, { status, headers: noStore });

/** Signed-in only; state-changing calls must come from this site. Errors the person can act on keep their words; the rest do not leak. */
export async function handle(request: Request, run: (user: SessionClient) => Promise<Response>, options: { write?: boolean } = {}): Promise<Response> {
  try {
    if (options.write && !isSameOrigin(request)) return failure(403, "Request blocked.");
    const user = await getSessionClient(request);
    if (!user) return failure(401, "Please sign in first.");
    return await run(user);
  } catch (error) {
    if (error instanceof CaptureError) return failure(error.status, error.message, error.details && typeof error.details === "object" ? (error.details as Record<string, unknown>) : undefined);
    console.error("[capture]", error instanceof Error ? (error.stack ?? error.message) : error);
    return failure(500, "Something went wrong on our side. Your work is saved; please try again.");
  }
}

export async function body<T = Record<string, unknown>>(request: Request, maxBytes = 64_000): Promise<T> {
  try {
    return (await readJson(request, maxBytes)) as T;
  } catch {
    throw new CaptureError(400, "That request could not be read.");
  }
}

export function download(content: string, filename: string, type = "text/plain; charset=utf-8"): Response {
  return new Response(content, { headers: { "Content-Type": type, "Content-Disposition": `attachment; filename="${filename.replace(/[^A-Za-z0-9._-]/g, "_")}"`, ...noStore } });
}

export const text = (value: unknown, max = 4000): string => (typeof value === "string" ? value.trim().slice(0, max) : "");
