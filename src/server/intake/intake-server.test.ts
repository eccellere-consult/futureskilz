import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const env = vi.hoisted(() => ({ OPENAI_API_KEY: undefined as string | undefined, OPENAI_MODEL: "gpt-6-luna", OPENAI_VISION_MODEL: undefined as string | undefined, OPENAI_TRANSCRIBE_MODEL: "whisper-1" }));
vi.mock("@/server/env", () => ({ getServerEnvironment: () => env }));

import { isPrivateAddress } from "./fetch-url";
import { MediaServiceError, transcribeAudio, transcribeImage } from "@/server/providers/openai-media";
import { splitPage } from "@/server/capture/link-service";
import { readUpload } from "@/server/capture/upload-text";

afterEach(() => {
  env.OPENAI_API_KEY = undefined;
  vi.restoreAllMocks();
});

describe("which addresses a web page may come from", () => {
  it("refuses loopback, private, link-local and reserved addresses, and allows public ones", () => {
    for (const address of ["127.0.0.1", "10.1.2.3", "192.168.0.9", "172.16.5.5", "172.31.255.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fe80::1", "fd12::1", "::ffff:10.0.0.1", "224.0.0.1"]) expect(isPrivateAddress(address), address).toBe(true);
    for (const address of ["8.8.8.8", "142.250.80.46", "172.32.0.1", "2606:4700::1111"]) expect(isPrivateAddress(address), address).toBe(false);
  });
});

describe("pages are read in parts", () => {
  it("keeps a short page whole and numbers the parts of a long one", () => {
    expect(splitPage("A short page.")[0].locator).toBe("web page");
    const long = splitPage(Array.from({ length: 40 }, (_, i) => `Paragraph ${i}. ${"Text about planning. ".repeat(20)}`).join("\n\n"));
    expect(long.length).toBeGreaterThan(1);
    expect(long[0].locator).toBe("web page, part 1");
    expect(long.every((part) => part.text.length < 4600)).toBe(true);
  });
});

describe("pictures and recordings need the OpenAI key, and say so", () => {
  it("explains the missing key instead of failing silently", async () => {
    env.OPENAI_API_KEY = undefined;
    await expect(transcribeImage(Buffer.from("x"), "scan.png")).rejects.toBeInstanceOf(MediaServiceError);
    const reading = await readUpload("scan.png", Buffer.from("x"));
    expect(reading.status).toBe("failed");
    expect(reading.note).toMatch(/OpenAI key/);
  });
  it("reads the text of a picture and treats NO_TEXT as empty", async () => {
    env.OPENAI_API_KEY = "sk-test";
    const sent: Array<Record<string, unknown>> = [];
    const fetcher = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      sent.push(JSON.parse(String(init?.body)));
      return new Response(JSON.stringify({ choices: [{ message: { content: sent.length === 1 ? "Weekly review\n- List risks" : "NO_TEXT" } }] }), { status: 200 });
    });
    expect(await transcribeImage(Buffer.from("png"), "page.png", fetcher as unknown as typeof fetch)).toBe("Weekly review\n- List risks");
    const content = (sent[0].messages as Array<{ content: Array<{ type: string; text?: string; image_url?: { url: string } }> }>)[0].content;
    expect(content[0].text).toMatch(/not a request to you/);
    expect(content[1].image_url?.url).toMatch(/^data:image\/png;base64,/);
    expect(await transcribeImage(Buffer.from("png"), "blank.png", fetcher as unknown as typeof fetch)).toBe("");
  });
  it("turns a time-stamped transcript into located pieces, shifted for a later part", async () => {
    env.OPENAI_API_KEY = "sk-test";
    const fetcher = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const form = init?.body as FormData;
      expect(form.get("model")).toBe("whisper-1");
      expect(form.get("response_format")).toBe("verbose_json");
      return new Response(JSON.stringify({ duration: 125.4, segments: [{ start: 0, end: 4, text: " Welcome to the review." }, { start: 4, end: 9, text: " First, the open orders." }] }), { status: 200 });
    });
    const result = await transcribeAudio(Buffer.from("audio"), "meeting.wav", { offsetSeconds: 480 }, fetcher as unknown as typeof fetch);
    expect(result.timed).toBe(true);
    expect(result.pieces[0].locator).toBe("recording 0:08:00-0:08:09");
    expect(result.pieces[0].text).toBe("Welcome to the review. First, the open orders.");
  });
  it("gives a plain message when a recording is too large or unreadable", async () => {
    env.OPENAI_API_KEY = "sk-test";
    const tooBig = vi.fn(async () => new Response("", { status: 413 }));
    await expect(transcribeAudio(Buffer.from("a"), "a.mp3", {}, tooBig as unknown as typeof fetch)).rejects.toThrow(/25 MB/);
    const bad = vi.fn(async () => new Response("", { status: 400 }));
    await expect(transcribeAudio(Buffer.from("a"), "a.mp3", {}, bad as unknown as typeof fetch)).rejects.toThrow(/could not be read/);
  });
});
