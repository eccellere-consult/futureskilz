import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("demo access code", () => {
  afterEach(() => vi.resetModules());

  it("allows the long run of correct calls the staged demo build makes, and still locks out guessing", async () => {
    process.env.DEMO_ACCESS_CODE = "a-long-demo-passphrase";
    const { checkCode } = await import("./access");
    for (let i = 0; i < 40; i += 1) expect(checkCode("a-long-demo-passphrase", "1.1.1.1")).toBe(true);
    for (let i = 0; i < 10; i += 1) expect(checkCode("wrong", "2.2.2.2")).toBe(false);
    expect(checkCode("a-long-demo-passphrase", "2.2.2.2")).toBe(false);
    expect(checkCode("a-long-demo-passphrase", "3.3.3.3")).toBe(true);
  });
});
