import { describe, expect, it } from "vitest";

import { createSessionToken, verifySessionToken } from "./session-token";

const secret = "a-development-secret-that-is-at-least-32-characters";

describe("session tokens", () => {
  it("round-trips a valid signed token", () => {
    const expiresAt = new Date("2030-01-01T00:00:00.000Z");
    const token = createSessionToken("session-123", expiresAt, secret);

    expect(verifySessionToken(token, secret, new Date("2029-01-01T00:00:00.000Z"))).toEqual({
      sessionId: "session-123",
      expiresAt: expiresAt.getTime(),
    });
  });

  it("rejects tampered and expired tokens", () => {
    const token = createSessionToken("session-123", new Date("2030-01-01T00:00:00.000Z"), secret);

    expect(verifySessionToken(`${token}x`, secret, new Date("2029-01-01T00:00:00.000Z"))).toBeNull();
    expect(verifySessionToken(token, secret, new Date("2031-01-01T00:00:00.000Z"))).toBeNull();
  });
});
