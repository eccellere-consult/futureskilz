import { describe, expect, it } from "vitest";

import type { NotificationMessage, NotificationProvider } from "../providers/notification";
import {
  completeSignIn,
  defaultRedirectPath,
  greetingName,
  type MagicLinkRepository,
  requestSignInLink,
  safeRedirectPath,
  signInLinkTtlMs,
  type SignInUser,
} from "./magic-link";
import { hashSessionToken, verifySessionToken } from "./session-token";

const secret = "a-development-secret-that-is-at-least-32-characters";
const appUrl = "https://futureskilz.in";

type StoredLink = {
  userId: string;
  tokenHash: string;
  redirectPath: string;
  payload: Record<string, unknown> | null;
  expiresAt: Date;
  createdAt: Date;
  consumedAt: Date | null;
};

function createRepository(now: () => Date) {
  const users = new Map<string, SignInUser>();
  const links: StoredLink[] = [];
  const requests: Array<{ ipHash: string; at: Date }> = [];
  const sessions: Array<{ id: string; userId: string; tokenHash: string; expiresAt: Date }> = [];

  const repository: MagicLinkRepository = {
    async findOrCreateUser(email, displayName) {
      const existing = [...users.values()].find((user) => user.email === email);
      if (existing) return existing;
      const user: SignInUser = { id: `user-${users.size + 1}`, email, displayName, status: "invited" };
      users.set(user.id, user);
      return user;
    },
    async countLinksSince(userId, since) {
      return links.filter((link) => link.userId === userId && link.createdAt >= since).length;
    },
    async countRequestsFromIpSince(ipHash, since) {
      return requests.filter((request) => request.ipHash === ipHash && request.at >= since).length;
    },
    async createLink(link) {
      links.push({ ...link, createdAt: now(), consumedAt: null });
    },
    async recordRequest({ ipHash }) {
      requests.push({ ipHash, at: now() });
    },
    async consumeLink(tokenHash, at) {
      const link = links.find((candidate) => candidate.tokenHash === tokenHash);
      if (!link || link.consumedAt || link.expiresAt <= at) return null;
      link.consumedAt = at;
      return { userId: link.userId, redirectPath: link.redirectPath, payload: link.payload };
    },
    async activateUser(userId) {
      const user = users.get(userId);
      if (user?.status === "invited") users.set(userId, { ...user, status: "active" });
    },
    async createSession(session) {
      sessions.push(session);
    },
  };

  return { repository, users, links, sessions };
}

function createMailbox() {
  const sent: NotificationMessage[] = [];
  const notifications: NotificationProvider = {
    channel: "email",
    async send(message) {
      sent.push(message);
      return { provider: "test", externalId: message.idempotencyKey, acceptedAt: new Date() };
    },
  };
  return { sent, notifications };
}

function tokenFrom(message: NotificationMessage | undefined): string {
  const url = new URL(message?.variables.link ?? "");
  expect(url.search).toBe("");
  return new URLSearchParams(url.hash.slice(1)).get("token") ?? "";
}

describe("safeRedirectPath", () => {
  it.each([
    ["/profile", "/profile"],
    ["/skill-shots/assumption-test", "/skill-shots/assumption-test"],
    ["/journey?from=email", "/journey?from=email"],
  ])("keeps same-site path %s", (input, expected) => {
    expect(safeRedirectPath(input)).toBe(expected);
  });

  it.each(["https://evil.com", "//evil.com", "/\\evil.com", "javascript:alert(1)", "profile", "", undefined, "/x\nSet-Cookie: a=b"])(
    "falls back for %s",
    (input) => {
      expect(safeRedirectPath(input)).toBe(defaultRedirectPath);
    },
  );
});

describe("greetingName", () => {
  it("keeps plain names and drops anything that could carry a message", () => {
    expect(greetingName("Priya")).toBe("Priya");
    expect(greetingName("Anne-Marie O'Neil")).toBe("Anne-Marie O'Neil");
    expect(greetingName("Win money at https://spam.example")).toBe("");
    expect(greetingName("<b>Bold</b>")).toBe("");
  });
});

describe("requestSignInLink and completeSignIn", () => {
  it("emails a single-use link that creates a 90-day session and carries the guest snapshot", async () => {
    let clock = new Date("2026-10-18T10:00:00.000Z");
    const now = () => clock;
    const { repository, links, sessions, users } = createRepository(now);
    const { sent, notifications } = createMailbox();
    const payload = { draft: { name: "Priya" } };

    const outcome = await requestSignInLink(
      { repository, notifications, appUrl, now },
      { email: " Priya@Example.com ", name: "Priya", next: "/skill-shots/assumption-test", nextSkillShotTitle: "Test the assumption underneath", payload, ipHash: "ip-1" },
    );

    expect(outcome).toBe("sent");
    expect(sent).toHaveLength(1);
    expect(sent[0]?.destination).toBe("priya@example.com");
    expect(sent[0]?.variables.nextSkillShot).toBe("Test the assumption underneath");
    const token = tokenFrom(sent[0]);
    expect(links[0]?.tokenHash).toBe(hashSessionToken(token));
    expect(links[0]?.tokenHash).not.toContain(token);

    clock = new Date(clock.getTime() + 60_000);
    const signIn = await completeSignIn({ repository, sessionSecret: secret, now }, token);
    expect(signIn).toMatchObject({ redirectPath: "/skill-shots/assumption-test", payload });
    expect(signIn?.expiresAt.getTime()).toBe(clock.getTime() + 90 * 24 * 60 * 60 * 1000);
    expect(verifySessionToken(signIn?.sessionToken ?? "", secret, clock)?.sessionId).toBe(sessions[0]?.id);
    expect(sessions[0]?.tokenHash).toBe(hashSessionToken(signIn?.sessionToken ?? ""));
    expect(users.get("user-1")?.status).toBe("active");

    expect(await completeSignIn({ repository, sessionSecret: secret, now }, token)).toBeNull();
  });

  it("rejects expired, unknown and malformed tokens", async () => {
    let clock = new Date("2026-10-18T10:00:00.000Z");
    const now = () => clock;
    const { repository } = createRepository(now);
    const { sent, notifications } = createMailbox();

    await requestSignInLink({ repository, notifications, appUrl, now }, { email: "a@example.com", ipHash: "ip" });
    clock = new Date(clock.getTime() + signInLinkTtlMs + 1);

    expect(await completeSignIn({ repository, sessionSecret: secret, now }, tokenFrom(sent[0]))).toBeNull();
    expect(await completeSignIn({ repository, sessionSecret: secret, now }, "A".repeat(43))).toBeNull();
    expect(await completeSignIn({ repository, sessionSecret: secret, now }, "not a token")).toBeNull();
  });

  it("limits links per email and requests per network", async () => {
    const now = () => new Date("2026-10-18T10:00:00.000Z");
    const { repository } = createRepository(now);
    const { sent, notifications } = createMailbox();
    const dependencies = { repository, notifications, appUrl, now };

    const perEmail = [];
    for (let index = 0; index < 4; index += 1) {
      perEmail.push(await requestSignInLink(dependencies, { email: "same@example.com", ipHash: `ip-${index}` }));
    }
    expect(perEmail).toEqual(["sent", "sent", "sent", "throttled"]);

    const perIp = [];
    for (let index = 0; index < 11; index += 1) {
      perIp.push(await requestSignInLink(dependencies, { email: `learner${index}@example.com`, ipHash: "shared-ip" }));
    }
    expect(perIp.filter((outcome) => outcome === "sent")).toHaveLength(10);
    expect(perIp.at(-1)).toBe("throttled");
    expect(sent).toHaveLength(13);
  });

  it("answers suspended accounts like any other without sending a link", async () => {
    const now = () => new Date("2026-10-18T10:00:00.000Z");
    const { repository, users } = createRepository(now);
    const { sent, notifications } = createMailbox();
    users.set("user-1", { id: "user-1", email: "blocked@example.com", displayName: "Blocked", status: "suspended" });

    expect(await requestSignInLink({ repository, notifications, appUrl, now }, { email: "blocked@example.com", ipHash: "ip" })).toBe("sent");
    expect(sent).toHaveLength(0);
  });
});
