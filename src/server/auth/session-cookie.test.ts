import { describe, expect, it } from "vitest";

import { sessionCookieName, sessionCookieOptions } from "./session-cookie";

describe("session cookie", () => {
  it("is inaccessible to scripts and restricted to same-site navigation", () => {
    expect(sessionCookieName).toBe("futureskilz_session");
    expect(sessionCookieOptions(true)).toEqual({
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
    });
  });

  it("permits local HTTP development without weakening production", () => {
    expect(sessionCookieOptions(false).secure).toBe(false);
  });
});