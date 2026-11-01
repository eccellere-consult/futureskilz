import "server-only";

import type { ServerEnvironment } from "@/server/env";

/**
 * Where Arya's studio voice comes from. The visitor's device voice needs no provider and costs nothing; OpenAI and xAI (Grok)
 * each offer a text-to-speech API. Anthropic does not: Claude writes words but has no voice API, so it is listed as unavailable
 * rather than faked. Which providers are offered depends on which keys are set, and ARYA_VOICE=browser switches every AI voice off.
 */
export type VoiceProvider = "openai" | "xai";
export type VoiceAvailability = { server: boolean; providers: { openai: boolean; xai: boolean }; anthropic: { available: false; reason: string }; default: VoiceProvider | null };

export const ANTHROPIC_NOTE = "Anthropic has no voice (text-to-speech) API. Claude can write what Arya says, but not speak it, so it cannot be a voice here.";

export function availability(environment: Pick<ServerEnvironment, "ARYA_VOICE" | "OPENAI_API_KEY" | "XAI_API_KEY">): VoiceAvailability {
  const on = environment.ARYA_VOICE === "auto";
  const providers = { openai: on && Boolean(environment.OPENAI_API_KEY), xai: on && Boolean(environment.XAI_API_KEY) };
  return { server: providers.openai || providers.xai, providers, anthropic: { available: false, reason: ANTHROPIC_NOTE }, default: providers.openai ? "openai" : providers.xai ? "xai" : null };
}

/** The provider to use: the one asked for if it is available, otherwise the default. Never a provider that is not configured. */
export function chooseProvider(requested: unknown, available: VoiceAvailability): VoiceProvider | null {
  if ((requested === "openai" || requested === "xai") && available.providers[requested]) return requested;
  return available.default;
}

const INSTRUCTIONS =
  "Speak as a warm, poised Indian woman in her early thirties with a natural Indian English accent. A calm, kind, professional counsellor: unhurried, clear, softly smiling, with natural pauses. Never sing-song, never robotic.";

/** Spoken audio (MP3) for the text, or null if the provider refused or failed. */
export async function synthesize(provider: VoiceProvider, text: string, environment: Pick<ServerEnvironment, "OPENAI_API_KEY" | "XAI_API_KEY">, fetchImplementation: typeof fetch = fetch): Promise<Buffer | null> {
  try {
    const response =
      provider === "openai"
        ? await fetchImplementation("https://api.openai.com/v1/audio/speech", {
            method: "POST",
            headers: { Authorization: `Bearer ${environment.OPENAI_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({ model: "gpt-4o-mini-tts", voice: "coral", input: text, instructions: INSTRUCTIONS, response_format: "mp3" }),
            signal: AbortSignal.timeout(20_000),
          })
        : await fetchImplementation("https://api.x.ai/v1/tts", {
            method: "POST",
            headers: { Authorization: `Bearer ${environment.XAI_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({ text, voice_id: "eve", language: "en" }),
            signal: AbortSignal.timeout(20_000),
          });
    if (!response.ok) return null;
    const bytes = Buffer.from(await response.arrayBuffer());
    return bytes.length > 0 ? bytes : null;
  } catch {
    return null;
  }
}
