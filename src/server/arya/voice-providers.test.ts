import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { availability, chooseProvider, synthesize } from "./voice-providers";

describe("voice providers", () => {
  it("offers only the providers that have a key, and none when AI voice is switched off", () => {
    expect(availability({ ARYA_VOICE: "auto", OPENAI_API_KEY: "o", XAI_API_KEY: "x" })).toMatchObject({ server: true, providers: { openai: true, xai: true }, default: "openai" });
    expect(availability({ ARYA_VOICE: "auto", OPENAI_API_KEY: undefined, XAI_API_KEY: "x" })).toMatchObject({ providers: { openai: false, xai: true }, default: "xai" });
    expect(availability({ ARYA_VOICE: "browser", OPENAI_API_KEY: "o", XAI_API_KEY: "x" })).toMatchObject({ server: false, default: null });
  });
  it("always says Anthropic cannot be a voice, rather than pretending", () => {
    const a = availability({ ARYA_VOICE: "auto", OPENAI_API_KEY: "o", XAI_API_KEY: "x" });
    expect(a.anthropic.available).toBe(false);
    expect(a.anthropic.reason).toMatch(/no voice/);
  });
  it("never picks a provider that is not configured", () => {
    const a = availability({ ARYA_VOICE: "auto", OPENAI_API_KEY: "o", XAI_API_KEY: undefined });
    expect(chooseProvider("xai", a)).toBe("openai");
    expect(chooseProvider("anthropic", a)).toBe("openai");
    expect(chooseProvider("openai", a)).toBe("openai");
    expect(chooseProvider("xai", availability({ ARYA_VOICE: "browser", OPENAI_API_KEY: "o", XAI_API_KEY: "x" }))).toBeNull();
  });
  it("calls each provider's own endpoint with its own key", async () => {
    const calls: Array<{ url: string; body: Record<string, unknown>; auth: string }> = [];
    const fake = (async (url: string, init: RequestInit) => { calls.push({ url, body: JSON.parse(String(init.body)), auth: String((init.headers as Record<string, string>).Authorization) }); return new Response(new Uint8Array([1, 2, 3])); }) as unknown as typeof fetch;
    const env = { OPENAI_API_KEY: "ok", XAI_API_KEY: "xk" };
    expect((await synthesize("openai", "Hello", env, fake))?.length).toBe(3);
    expect((await synthesize("xai", "Hello", env, fake))?.length).toBe(3);
    expect(calls[0]).toMatchObject({ url: "https://api.openai.com/v1/audio/speech", auth: "Bearer ok" });
    expect(calls[1]).toMatchObject({ url: "https://api.x.ai/v1/tts", auth: "Bearer xk", body: { text: "Hello", language: "en" } });
  });
  it("returns nothing, not an error, when the provider fails", async () => {
    const env = { OPENAI_API_KEY: "ok", XAI_API_KEY: "xk" };
    expect(await synthesize("xai", "Hi", env, (async () => new Response("no", { status: 500 })) as unknown as typeof fetch)).toBeNull();
    expect(await synthesize("openai", "Hi", env, (async () => { throw new Error("down"); }) as unknown as typeof fetch)).toBeNull();
  });
});
