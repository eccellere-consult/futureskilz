import { createHmac, randomBytes, randomUUID } from "node:crypto";

import type { NotificationProvider } from "../providers/notification";
import { createSessionToken, hashSessionToken } from "./session-token";

export const signInResourceType = "sign-in";
export const signInLinkTtlMs = 15 * 60 * 1000;
export const sessionTtlMs = 90 * 24 * 60 * 60 * 1000;
export const sessionRenewThresholdMs = 30 * 24 * 60 * 60 * 1000;
export const emailLinkLimit = { count: 3, windowMs: 15 * 60 * 1000 };
export const ipRequestLimit = { count: 10, windowMs: 60 * 60 * 1000 };
export const defaultRedirectPath = "/home";

export type SignInUser = { id: string; email: string; displayName: string; status: "invited" | "active" | "suspended" };

export interface MagicLinkRepository {
  findOrCreateUser(email: string, displayName: string): Promise<SignInUser>;
  countLinksSince(userId: string, since: Date): Promise<number>;
  countRequestsFromIpSince(ipHash: string, since: Date): Promise<number>;
  createLink(link: {
    userId: string;
    tokenHash: string;
    redirectPath: string;
    payload: Record<string, unknown> | null;
    expiresAt: Date;
  }): Promise<void>;
  recordRequest(request: { userId: string; ipHash: string }): Promise<void>;
  /** Marks the link consumed only if it is unused and unexpired; returns null otherwise. */
  consumeLink(tokenHash: string, now: Date): Promise<{
    userId: string;
    redirectPath: string;
    payload: Record<string, unknown> | null;
  } | null>;
  activateUser(userId: string): Promise<void>;
  createSession(session: { id: string; userId: string; tokenHash: string; expiresAt: Date }): Promise<void>;
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

/** Only same-site absolute paths are allowed, so a link can never send a learner to another site. */
export function safeRedirectPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return defaultRedirectPath;
  if (/[\u0000-\u001f\u007f]/.test(value) || value.length > 160) return defaultRedirectPath;

  try {
    const parsed = new URL(value, "https://futureskilz.invalid");
    if (parsed.origin !== "https://futureskilz.invalid") return defaultRedirectPath;
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return defaultRedirectPath;
  }
}

/** Greeting names come from the learner, so anything that is not a plain name is replaced. */
export function greetingName(value: string | undefined): string {
  const name = value?.trim() ?? "";
  return /^[\p{L}][\p{L} .'-]{0,39}$/u.test(name) ? name : "";
}

export function hashRequestIp(ip: string, secret: string): string {
  return createHmac("sha256", secret).update(ip).digest("hex");
}

export function createLinkToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashSessionToken(token) };
}

export type RequestSignInInput = {
  email: string;
  name?: string;
  next?: string;
  nextSkillShotTitle?: string;
  payload?: Record<string, unknown> | null;
  ipHash: string;
};

export type RequestSignInDependencies = {
  repository: MagicLinkRepository;
  notifications: NotificationProvider;
  appUrl: string;
  now?: () => Date;
};

export async function requestSignInLink(
  dependencies: RequestSignInDependencies,
  input: RequestSignInInput,
): Promise<"sent" | "throttled"> {
  const now = dependencies.now?.() ?? new Date();
  const email = normalizeEmail(input.email);
  const name = greetingName(input.name);

  if (
    (await dependencies.repository.countRequestsFromIpSince(input.ipHash, new Date(now.getTime() - ipRequestLimit.windowMs))) >=
    ipRequestLimit.count
  ) {
    return "throttled";
  }

  const user = await dependencies.repository.findOrCreateUser(email, name || email.split("@")[0] || "Learner");
  // Suspended accounts get the same answer as everyone else, so the response reveals nothing.
  if (user.status === "suspended") return "sent";
  if ((await dependencies.repository.countLinksSince(user.id, new Date(now.getTime() - emailLinkLimit.windowMs))) >= emailLinkLimit.count) {
    return "throttled";
  }

  const { token, tokenHash } = createLinkToken();
  const redirectPath = safeRedirectPath(input.next);
  await dependencies.repository.createLink({
    userId: user.id,
    tokenHash,
    redirectPath,
    payload: input.payload ?? null,
    expiresAt: new Date(now.getTime() + signInLinkTtlMs),
  });
  await dependencies.repository.recordRequest({ userId: user.id, ipHash: input.ipHash });

  // The token rides in the fragment, which browsers never send to a server, so no access log can hold it.
  const link = new URL("/auth/verify", dependencies.appUrl);
  link.hash = new URLSearchParams({ token }).toString();
  await dependencies.notifications.send({
    destination: email,
    templateKey: "auth.sign-in",
    variables: {
      name: name || greetingName(user.displayName),
      link: link.toString(),
      nextSkillShot: input.nextSkillShotTitle ?? "",
    },
    idempotencyKey: `sign-in:${tokenHash.slice(0, 32)}`,
  });

  return "sent";
}

export type CompletedSignIn = {
  userId: string;
  sessionToken: string;
  expiresAt: Date;
  redirectPath: string;
  payload: Record<string, unknown> | null;
};

export async function completeSignIn(
  dependencies: { repository: MagicLinkRepository; sessionSecret: string; now?: () => Date },
  token: string,
): Promise<CompletedSignIn | null> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;

  const now = dependencies.now?.() ?? new Date();
  const link = await dependencies.repository.consumeLink(hashSessionToken(token), now);
  if (!link) return null;

  await dependencies.repository.activateUser(link.userId);
  const sessionId = randomUUID();
  const expiresAt = new Date(now.getTime() + sessionTtlMs);
  const sessionToken = createSessionToken(sessionId, expiresAt, dependencies.sessionSecret);
  await dependencies.repository.createSession({
    id: sessionId,
    userId: link.userId,
    tokenHash: hashSessionToken(sessionToken),
    expiresAt,
  });

  return { userId: link.userId, sessionToken, expiresAt, redirectPath: safeRedirectPath(link.redirectPath), payload: link.payload };
}
