import { describe, expect, it, vi } from "vitest";

import { PersistedSessionProvider, type PersistedSession, type SessionRepository } from "./persisted-provider";
import { createSessionToken, hashSessionToken } from "./session-token";

const secret = "a-development-secret-that-is-at-least-32-characters";
const now = new Date("2029-01-01T00:00:00.000Z");
const expiresAt = new Date("2030-01-01T00:00:00.000Z");
const token = createSessionToken("session-123", expiresAt, secret);

function createSession(overrides: Partial<PersistedSession> = {}): PersistedSession {
  return {
    id: "session-123",
    tokenHash: hashSessionToken(token),
    expiresAt,
    revokedAt: null,
    user: {
      id: "user-123",
      email: "learner@example.com",
      displayName: "Learner",
      organizationId: null,
      roles: ["learner"],
    },
    ...overrides,
  };
}

function createRepository(session: PersistedSession | null): SessionRepository {
  return {
    findById: vi.fn().mockResolvedValue(session),
    revoke: vi.fn().mockResolvedValue(undefined),
  };
}

describe("persisted session provider", () => {
  it("returns the user only when the signed token and persisted verifier agree", async () => {
    const provider = new PersistedSessionProvider(token, secret, createRepository(createSession()), () => now);

    await expect(provider.getSession()).resolves.toMatchObject({
      user: { id: "user-123", roles: ["learner"] },
      expiresAt,
    });
  });

  it.each([
    ["missing", null],
    ["revoked", createSession({ revokedAt: now })],
    ["database-expired", createSession({ expiresAt: new Date("2028-01-01T00:00:00.000Z") })],
    ["verifier-mismatch", createSession({ tokenHash: hashSessionToken(`${token}x`) })],
  ])("rejects a %s persisted session", async (_case, session) => {
    const provider = new PersistedSessionProvider(token, secret, createRepository(session), () => now);

    await expect(provider.getSession()).resolves.toBeNull();
  });

  it("revokes a valid session on sign out", async () => {
    const repository = createRepository(createSession());
    const provider = new PersistedSessionProvider(token, secret, repository, () => now);

    await provider.signOut();

    expect(repository.revoke).toHaveBeenCalledWith("session-123", now);
  });
});