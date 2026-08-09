import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export type SessionTokenPayload = {
  sessionId: string;
  expiresAt: number;
};

function signatureFor(payload: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(payload).digest();
}

export function createSessionToken(
  sessionId: string,
  expiresAt: Date,
  secret: string,
): string {
  const payload = Buffer.from(
    JSON.stringify({ sessionId, expiresAt: expiresAt.getTime() } satisfies SessionTokenPayload),
  ).toString("base64url");
  const signature = signatureFor(payload, secret).toString("base64url");
  return `${payload}.${signature}`;
}

export function verifySessionToken(
  token: string,
  secret: string,
  now = new Date(),
): SessionTokenPayload | null {
  const [payload, encodedSignature, extra] = token.split(".");
  if (!payload || !encodedSignature || extra) return null;

  const expected = signatureFor(payload, secret);
  const actual = Buffer.from(encodedSignature, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;

  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as unknown;
    if (
      typeof decoded !== "object" ||
      decoded === null ||
      !("sessionId" in decoded) ||
      !("expiresAt" in decoded) ||
      typeof decoded.sessionId !== "string" ||
      typeof decoded.expiresAt !== "number" ||
      decoded.expiresAt <= now.getTime()
    ) {
      return null;
    }
    return { sessionId: decoded.sessionId, expiresAt: decoded.expiresAt };
  } catch {
    return null;
  }
}

export function createOpaqueSessionId(): string {
  return randomBytes(32).toString("base64url");
}
