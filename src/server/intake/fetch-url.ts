import "server-only";

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

import { readablePage } from "@/features/intake/html";
import { CaptureError } from "@/server/capture/shared";

const MAX_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 10_000;
const MAX_HOPS = 3;

/** True for an address a public web page should never resolve to: loopback, private, link-local (cloud metadata), reserved. */
export function isPrivateAddress(address: string): boolean {
  const lower = address.toLowerCase();
  if (isIP(lower) === 6) {
    if (lower === "::1" || lower === "::") return true;
    if (lower.startsWith("fe8") || lower.startsWith("fe9") || lower.startsWith("fea") || lower.startsWith("feb")) return true;
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(lower);
    return mapped ? isPrivateAddress(mapped[1]) : false;
  }
  const parts = lower.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return true;
  const [a, b] = parts;
  return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 192 && b === 0) || a >= 224;
}

async function assertPublic(url: URL): Promise<void> {
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new CaptureError(400, "Use a web address that starts with https://.");
  if (url.username || url.password) throw new CaptureError(400, "Remove the user name and password from that address.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) throw new CaptureError(400, "That address is not a public web page.");
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => []);
  if (!addresses.length) throw new CaptureError(422, "That web address could not be found.");
  if (addresses.some((entry) => isPrivateAddress(entry.address))) throw new CaptureError(400, "That address is not a public web page.");
}

export type Guarded = { url: string; type: string; body: string };

/**
 * Fetches a public address as text. Only public addresses are allowed, at every redirect; size and time are capped. What comes back is
 * data to read, never instructions. `types` lists the content types accepted.
 */
export async function fetchGuarded(rawUrl: string, options: { accept: string; types: RegExp; maxBytes?: number; headers?: Record<string, string>; wrongType: string }): Promise<Guarded> {
  const maxBytes = options.maxBytes ?? MAX_BYTES;
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    throw new CaptureError(400, "That does not look like a web address.");
  }
  for (let hop = 0; hop <= MAX_HOPS; hop += 1) {
    await assertPublic(url);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(url, { redirect: "manual", signal: controller.signal, headers: { "User-Agent": "Mozilla/5.0 (compatible; FutureSkilzReader/1.0)", Accept: options.accept, ...options.headers } });
      if (response.status >= 300 && response.status < 400 && response.headers.get("location")) {
        url = new URL(response.headers.get("location") as string, url);
        continue;
      }
      if (!response.ok) throw new CaptureError(422, `That page answered with an error (${response.status}). Check the address, or paste the text instead.`);
      const type = response.headers.get("content-type") ?? "";
      if (!options.types.test(type)) throw new CaptureError(422, options.wrongType);
      const reader = response.body?.getReader();
      if (!reader) throw new CaptureError(422, "That page had no content.");
      const chunks: Uint8Array[] = [];
      let size = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > maxBytes) {
          await reader.cancel();
          throw new CaptureError(413, `That page is larger than ${Math.round(maxBytes / 1024 / 1024)} MB. Save the part you need and upload it instead.`);
        }
        chunks.push(value);
      }
      return { url: url.toString(), type, body: Buffer.concat(chunks).toString("utf8") };
    } catch (error) {
      if (error instanceof CaptureError) throw error;
      throw new CaptureError(422, "That page could not be fetched. Check the address, or paste the text instead.");
    } finally {
      clearTimeout(timer);
    }
  }
  throw new CaptureError(422, "That address redirected too many times.");
}

export type FetchedPage = { url: string; title: string | null; text: string };

/** A public web page as readable text, with its final address (after redirects) for the citation. */
export async function fetchPage(rawUrl: string): Promise<FetchedPage> {
  const got = await fetchGuarded(rawUrl, { accept: "text/html,text/plain;q=0.9", types: /text\/html|text\/plain|application\/xhtml/i, wrongType: "That address is not a web page or text. Download the file and upload it instead." });
  const page = /text\/plain/i.test(got.type) ? { title: null, text: got.body.trim() } : readablePage(got.body);
  if (page.text.length < 200) throw new CaptureError(422, "Very little text could be read from that page (it may need a login or build its text in the browser). Paste the text instead.");
  return { url: got.url, title: page.title, text: page.text };
}
