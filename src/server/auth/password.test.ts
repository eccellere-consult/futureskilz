import { describe, expect, it } from "vitest";

import { dummyHash, generatePassword, hashPassword, passwordProblem, verifyPassword } from "./password";

describe("password hashing", () => {
  it("accepts the right password and rejects a wrong one", async () => {
    const hash = await hashPassword("correct horse battery");
    expect(await verifyPassword("correct horse battery", hash)).toBe(true);
    expect(await verifyPassword("correct horse batterY", hash)).toBe(false);
  });

  it("never stores the password and salts every hash", async () => {
    const [a, b] = await Promise.all([hashPassword("same password here"), hashPassword("same password here")]);
    expect(a).not.toContain("same password here");
    expect(a).not.toBe(b);
    expect(a.startsWith("scrypt$16384$8$1$")).toBe(true);
  });

  it("treats a malformed or foreign hash as a failed check, not an error", async () => {
    expect(await verifyPassword("x", "")).toBe(false);
    expect(await verifyPassword("x", "bcrypt$whatever")).toBe(false);
  });

  it("has a dummy hash for unknown accounts that never matches", async () => {
    expect(await verifyPassword("anything at all", await dummyHash())).toBe(false);
  });

  it("generates readable random passwords that meet its own rules", () => {
    const seen = new Set(Array.from({ length: 50 }, generatePassword));
    expect(seen.size).toBe(50);
    for (const password of seen) {
      expect(password).toMatch(/^[A-Za-z2-9]{4}(-[A-Za-z2-9]{4}){3}$/);
      expect(password).not.toMatch(/[0OIl1]/);
      expect(passwordProblem(password)).toBeNull();
    }
  });

  it("asks for length and variety", () => {
    expect(passwordProblem("short")).toMatch(/at least 12/);
    expect(passwordProblem("aaaaaaaaaaaaaaaa")).toMatch(/repetitive/);
    expect(passwordProblem("a perfectly fine phrase")).toBeNull();
  });
});
