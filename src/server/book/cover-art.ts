import type { Book } from "@/features/book/types";

/**
 * Front-cover artwork from the OpenAI Images API. Optional: with no key, or if the service fails, the cover is drawn with type
 * and shapes instead. The picture carries no words, because the title is set in type on top of it.
 */
export function coverPrompt(book: Book): string {
  const theme = [book.title, book.subtitle, book.bigIdea].filter(Boolean).join(". ").slice(0, 400);
  return `Abstract, elegant book cover artwork for a thoughtful business and career book. Theme: ${theme}. Deep navy and warm gold palette with soft light, subtle texture and generous empty space in the upper and middle areas for a title. Portrait orientation. No text, no letters, no numbers, no logos, no people's faces.`;
}

export type ImageFetch = typeof fetch;

export async function generateCoverArt(book: Book, apiKey: string | undefined, fetchImplementation: ImageFetch = fetch): Promise<Buffer | null> {
  if (!apiKey) return null;
  try {
    const response = await fetchImplementation("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: "gpt-image-1", prompt: coverPrompt(book), size: "1024x1536", n: 1 }),
      signal: AbortSignal.timeout(110_000),
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as { data?: Array<{ b64_json?: string }> };
    const encoded = payload.data?.[0]?.b64_json;
    return encoded ? Buffer.from(encoded, "base64") : null;
  } catch {
    return null;
  }
}
