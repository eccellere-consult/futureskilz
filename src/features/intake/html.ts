/** Turns a web page's HTML into plain readable text, dropping scripts, menus and footers. Rule-based and dependency-free. */

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", ndash: "–", mdash: "—", hellip: "…" };

const decode = (text: string): string =>
  text
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Math.min(Number(code), 0x10ffff)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Math.min(parseInt(code, 16), 0x10ffff)))
    .replace(/&([a-z]+);/gi, (whole, name: string) => ENTITIES[name.toLowerCase()] ?? whole);

export type ReadablePage = { title: string | null; text: string };

export function readablePage(html: string): ReadablePage {
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1];
  let body = html;
  const main = /<(article|main)\b[^>]*>([\s\S]*?)<\/\1>/i.exec(html);
  if (main) body = main[2];
  body = body
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|nav|header|footer|aside|form|iframe)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<(br|\/p|\/div|\/h[1-6]|\/li|\/tr|\/section|\/blockquote)\s*\/?>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "\n- ")
    .replace(/<h[1-6]\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  const text = decode(body)
    .replace(/[ \t]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { title: title ? decode(title).replace(/\s+/g, " ").trim().slice(0, 200) : null, text };
}
