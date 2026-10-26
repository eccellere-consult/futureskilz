/**
 * /api/arya/speech — Arya's studio voice. GET says whether it is on; POST { text } returns spoken audio (MP3).
 * Falls back (client side) to the visitor's own device voice whenever this is off, rate-limited or failing.
 * The text is only what Arya says to the visitor (greetings and questions), capped in length and cached.
 */
import { createHash } from "node:crypto";

import { NextResponse } from "next/server";

import { getServerEnvironment } from "@/server/env";
import { clientIp, isSameOrigin, readJson } from "@/server/http/request";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };

const MODEL = "gpt-4o-mini-tts";
const VOICE = "coral";
const INSTRUCTIONS =
  "Speak as a warm, poised Indian woman in her early thirties with a natural Indian English accent. A calm, kind, professional counsellor: unhurried, clear, softly smiling, with natural pauses. Never sing-song, never robotic.";

const enabled = (): boolean => {
  const environment = getServerEnvironment();
  return environment.ARYA_VOICE === "auto" && !!environment.OPENAI_API_KEY;
};

const cache = new Map<string, Buffer>();
const hits = new Map<string, { count: number; first: number }>();

function allowed(ip: string): boolean {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || now - entry.first > 10 * 60_000) {
    hits.set(ip, { count: 1, first: now });
    return true;
  }
  entry.count += 1;
  return entry.count <= 40;
}

export async function GET() {
  return NextResponse.json({ server: enabled() }, { headers });
}

export async function POST(request: Request) {
  if (!enabled()) return NextResponse.json({ error: "Studio voice is off." }, { status: 404, headers });
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request blocked." }, { status: 403, headers });
  if (!allowed(clientIp(request))) return NextResponse.json({ error: "Too many voice requests. Please wait a few minutes." }, { status: 429, headers });
  const input = (await readJson(request, 4_000).catch(() => ({}))) as { text?: unknown };
  const text = typeof input.text === "string" ? input.text.replace(/\s+/g, " ").trim().slice(0, 700) : "";
  if (text.length < 2) return NextResponse.json({ error: "Nothing to say." }, { status: 400, headers });

  const key = createHash("sha256").update(text).digest("hex");
  let audio = cache.get(key);
  if (!audio) {
    try {
      const response = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: { Authorization: `Bearer ${getServerEnvironment().OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: MODEL, voice: VOICE, input: text, instructions: INSTRUCTIONS, response_format: "mp3" }),
        signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) return NextResponse.json({ error: "The studio voice is unavailable." }, { status: 502, headers });
      audio = Buffer.from(await response.arrayBuffer());
    } catch {
      return NextResponse.json({ error: "The studio voice is unavailable." }, { status: 502, headers });
    }
    if (cache.size >= 80) cache.delete(cache.keys().next().value as string);
    cache.set(key, audio);
  }
  return new Response(new Uint8Array(audio), { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, max-age=3600" } });
}
