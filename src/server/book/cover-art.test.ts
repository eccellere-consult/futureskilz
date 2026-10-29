import { describe, expect, it } from "vitest";

import { outlineBook } from "@/features/book/outline";

import { coverPrompt, generateCoverArt } from "./cover-art";

const book = outlineBook({ author: "Ravi Menon", answers: [{ key: "a", phase: "A", question: "q", answer: "I want newcomers to learn patience from the plant floor every day." }] });

describe("cover art", () => {
  it("asks for no text in the picture", () => expect(coverPrompt(book)).toMatch(/No text/));
  it("returns nothing without a key", async () => expect(await generateCoverArt(book, undefined)).toBeNull());
  it("returns the image when the service answers", async () => {
    const fake = (async () => new Response(JSON.stringify({ data: [{ b64_json: Buffer.from("png").toString("base64") }] }))) as typeof fetch;
    expect((await generateCoverArt(book, "k", fake))?.toString()).toBe("png");
  });
  it("returns nothing, not an error, when the service fails", async () => {
    expect(await generateCoverArt(book, "k", (async () => new Response("no", { status: 500 })) as typeof fetch)).toBeNull();
    expect(await generateCoverArt(book, "k", (async () => { throw new Error("down"); }) as typeof fetch)).toBeNull();
  });
});
