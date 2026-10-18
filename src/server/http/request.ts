import "server-only";

/** Hostinger sits behind a proxy, so the first forwarded address is the visitor. */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip")?.trim() || "unknown";
}

/** Rejects cross-site form posts to state-changing routes. */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function readJson(request: Request, maxBytes = 64_000): Promise<unknown> {
  const body = await request.text();
  if (body.length > maxBytes) throw new Error("Request body is too large.");
  return body ? JSON.parse(body) : {};
}
