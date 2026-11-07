import PDFDocument from "pdfkit";

import type { Book, BookSection } from "@/features/book/types";

import { cgItalicBase64, cgSemiboldBase64, dmsBoldBase64, dmsMediumBase64, ebgBoldBase64, ebgItalicBase64, ebgRegularBase64 } from "./fonts.generated";
import { BLEED, coverSize, INTERIOR_MARGINS, MIN_PAGES, PT, TRIM, minInsideMargin } from "./kdp";

/**
 * Print-ready PDFs for a 6 x 9 inch KDP paperback: an interior and a wrap-around cover. Fonts are embedded subsets, so the file
 * needs no network and no system fonts. The cover can carry AI-made artwork; without it, a typographic cover is drawn instead.
 */
const COLOURS = { ink: "#1b1b1f", muted: "#5b5b66", accent: "#b4532a", navy: "#14213d", cream: "#faf6ee", gold: "#c9a227", white: "#ffffff" };

const FONTS = {
  body: ["body", ebgRegularBase64], italic: ["italic", ebgItalicBase64], bold: ["bold", ebgBoldBase64],
  display: ["display", cgSemiboldBase64], displayItalic: ["displayItalic", cgItalicBase64], sans: ["sans", dmsMediumBase64], sansBold: ["sansBold", dmsBoldBase64],
} as const;

export function newDoc(width: number, height: number): PDFKit.PDFDocument {
  const doc = new PDFDocument({ size: [width, height], margin: 0, autoFirstPage: false, font: undefined as never, info: { Producer: "FutureSkilz", Creator: "FutureSkilz" } });
  for (const [name, data] of Object.values(FONTS)) doc.registerFont(name, Buffer.from(data, "base64"));
  return doc;
}

export function collect(doc: PDFKit.PDFDocument): Promise<Buffer> {
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
}

const inch = (value: number) => value * PT;

export type InteriorResult = { pdf: Buffer; pages: number };

export async function renderInterior(book: Book): Promise<InteriorResult> {
  const width = inch(TRIM.width);
  const height = inch(TRIM.height);
  const doc = newDoc(width, height);
  doc.info.Title = book.title;
  doc.info.Author = book.author;
  doc.info.Subject = book.subtitle;
  doc.info.Keywords = book.kdp.keywords.join(", ");

  const margins = { ...INTERIOR_MARGINS };
  let page = 0;
  let running = "";
  let numbered = false;

  // Pages alternate: odd pages are on the right with the wider margin on the left (inside).
  const geometry = (index: number) => {
    const right = index % 2 === 1;
    const left = inch(right ? margins.inside : margins.outside);
    const rightMargin = inch(right ? margins.outside : margins.inside);
    return { left, width: width - left - rightMargin, top: inch(margins.top), bottom: height - inch(margins.bottom) };
  };

  const decorate = () => {
    if (!numbered) return;
    const g = geometry(page);
    doc.font("sans").fontSize(8).fillColor(COLOURS.muted);
    doc.text(String(page), g.left, height - inch(0.5), { width: g.width, align: "center", lineBreak: false });
    if (running) doc.font("italic").fontSize(9).text(running, g.left, inch(0.42), { width: g.width, align: page % 2 === 0 ? "left" : "right", lineBreak: false });
  };

  const addPage = () => {
    doc.addPage({ size: [width, height], margin: 0 });
    page += 1;
    doc.fillColor(COLOURS.ink);
    return geometry(page);
  };
  doc.on("pageAdded", () => undefined);

  const flow = (g: ReturnType<typeof geometry>, y: number) => ({ g, y });
  let cursor = flow(geometry(1), 0);

  const newBodyPage = (): ReturnType<typeof flow> => {
    decorateLater();
    const g = addPage();
    return flow(g, g.top);
  };
  // Page furniture is drawn when a page is finished, so the running head reflects the section it holds.
  let pending = false;
  const decorateLater = () => { if (pending) decorate(); pending = false; };
  const startPage = (): ReturnType<typeof flow> => {
    decorateLater();
    pending = true;
    const g = addPage();
    return flow(g, g.top);
  };
  void newBodyPage;

  const heightOf = (text: string, font: string, size: number, w: number, gap = 0) => {
    doc.font(font).fontSize(size);
    return doc.heightOfString(text, { width: w, lineGap: gap });
  };

  const writeParagraph = (text: string, opts: { font?: string; size?: number; indentFirst?: boolean; gap?: number; after?: number; align?: "justify" | "left" | "center"; colour?: string } = {}) => {
    const font = opts.font ?? "body";
    const size = opts.size ?? 11;
    const lineGap = opts.gap ?? 2.4;
    const words = text.split(/\s+/);
    // Break long paragraphs across pages by words, keeping at least two lines together.
    let remaining = words;
    let first = true;
    while (remaining.length) {
      const g = cursor.g;
      const room = g.bottom - cursor.y;
      doc.font(font).fontSize(size);
      const lineHeight = doc.currentLineHeight(true) + lineGap;
      if (room < lineHeight * 2) {
        cursor = startPage();
        continue;
      }
      const fits = (count: number) => heightOf(remaining.slice(0, count).join(" "), font, size, g.width, lineGap) <= room;
      let count = remaining.length;
      if (!fits(count)) {
        let low = 1;
        let high = count;
        while (low < high) {
          const mid = Math.ceil((low + high) / 2);
          if (fits(mid)) low = mid; else high = mid - 1;
        }
        count = low;
      }
      const chunk = remaining.slice(0, count).join(" ");
      doc.fillColor(opts.colour ?? COLOURS.ink).font(font).fontSize(size);
      doc.text(chunk, g.left, cursor.y, { width: g.width, align: opts.align ?? "justify", lineGap, indent: first && opts.indentFirst ? 14 : 0 });
      cursor.y = doc.y;
      remaining = remaining.slice(count);
      first = false;
      if (remaining.length) cursor = startPage();
    }
    cursor.y += opts.after ?? 4;
  };

  const writeSection = (section: BookSection, dropCap: boolean) => {
    if (section.heading) {
      if (cursor.g.bottom - cursor.y < 90) cursor = startPage();
      cursor.y += 8;
      doc.font("sansBold").fontSize(9.5).fillColor(COLOURS.accent).text(section.heading.toUpperCase(), cursor.g.left, cursor.y, { width: cursor.g.width, characterSpacing: 1.2 });
      cursor.y = doc.y + 6;
    }
    section.paragraphs.forEach((paragraph, index) => {
      writeParagraph(paragraph, { indentFirst: !(dropCap && index === 0) && index > 0 || (!section.heading && index > 0) });
    });
    if (section.pullQuote) {
      const g = cursor.g;
      const h = heightOf(`“${section.pullQuote}”`, "displayItalic", 15, g.width - 28, 3) + 22;
      if (g.bottom - cursor.y < h + 10) cursor = startPage();
      const g2 = cursor.g;
      doc.rect(g2.left, cursor.y + 4, 2.5, h - 8).fill(COLOURS.accent);
      doc.font("displayItalic").fontSize(15).fillColor(COLOURS.navy).text(`“${section.pullQuote}”`, g2.left + 16, cursor.y + 8, { width: g2.width - 28, lineGap: 3 });
      cursor.y = doc.y + 16;
    }
  };

  const chapterOpener = (label: string, title: string, subtitle?: string, epigraph?: { text: string; by?: string }) => {
    running = book.title;
    // Chapter openers always begin on a right-hand (odd) page, so a blank left page is added when needed.
    decorateLater();
    if ((page + 1) % 2 === 0) addPage();
    cursor = startPage();
    const g = cursor.g;
    let y = inch(1.6);
    doc.font("sansBold").fontSize(10).fillColor(COLOURS.accent).text(label.toUpperCase(), g.left, y, { width: g.width, align: "center", characterSpacing: 3 });
    y = doc.y + 14;
    doc.moveTo(g.left + g.width / 2 - 18, y).lineTo(g.left + g.width / 2 + 18, y).lineWidth(1).strokeColor(COLOURS.gold).stroke();
    y += 18;
    doc.font("display").fontSize(27).fillColor(COLOURS.navy).text(title, g.left, y, { width: g.width, align: "center", lineGap: 2 });
    y = doc.y + 8;
    if (subtitle) { doc.font("displayItalic").fontSize(13).fillColor(COLOURS.muted).text(subtitle, g.left, y, { width: g.width, align: "center" }); y = doc.y + 18; }
    if (epigraph) {
      doc.font("italic").fontSize(10.5).fillColor(COLOURS.muted).text(`“${epigraph.text}”`, g.left + 20, y, { width: g.width - 40, align: "center" });
      y = doc.y + 4;
      if (epigraph.by) { doc.font("sans").fontSize(8.5).text(`— ${epigraph.by}`, g.left, y, { width: g.width, align: "center" }); y = doc.y; }
      y += 14;
    }
    cursor.y = Math.max(y + 10, inch(3.5));
  };

  // 1. Half title, blank, title page, copyright, dedication (no page numbers).
  cursor = startPage();
  doc.font("display").fontSize(22).fillColor(COLOURS.navy).text(book.title, cursor.g.left, inch(3.2), { width: cursor.g.width, align: "center" });
  cursor = startPage();
  cursor = startPage();
  {
    const g = cursor.g;
    doc.font("display").fontSize(34).fillColor(COLOURS.navy).text(book.title, g.left, inch(2.0), { width: g.width, align: "center", lineGap: 2 });
    let y = doc.y + 10;
    doc.moveTo(g.left + g.width / 2 - 24, y).lineTo(g.left + g.width / 2 + 24, y).lineWidth(1.2).strokeColor(COLOURS.gold).stroke();
    y += 16;
    doc.font("displayItalic").fontSize(15).fillColor(COLOURS.muted).text(book.subtitle, g.left, y, { width: g.width, align: "center" });
    doc.font("sansBold").fontSize(11).fillColor(COLOURS.ink).text(book.author.toUpperCase(), g.left, height - inch(2.2), { width: g.width, align: "center", characterSpacing: 3 });
  }
  cursor = startPage();
  {
    const g = cursor.g;
    const year = new Date(book.generatedAt).getUTCFullYear() || new Date().getUTCFullYear();
    doc.font("body").fontSize(8.5).fillColor(COLOURS.muted);
    doc.text(`Copyright © ${year} ${book.author}. All rights reserved.\n\nNo part of this book may be reproduced without the written permission of the author, except for brief quotations in reviews.\n\n${book.disclosure}\n\nFirst edition.`, g.left, inch(5.2), { width: g.width, lineGap: 3 });
  }
  cursor = startPage();
  doc.font("displayItalic").fontSize(14).fillColor(COLOURS.muted).text(book.dedication, cursor.g.left, inch(3.4), { width: cursor.g.width, align: "center" });

  // 2. Contents.
  numbered = true;
  cursor = startPage();
  doc.font("display").fontSize(22).fillColor(COLOURS.navy).text("Contents", cursor.g.left, inch(1.1), { width: cursor.g.width, align: "center" });
  cursor.y = inch(1.9);
  const contents = [book.introduction.title, ...book.chapters.map((c) => `${c.number}. ${c.title}`), book.conclusion.title, "About the Author"];
  for (const line of contents) {
    doc.font("body").fontSize(12.5).fillColor(COLOURS.ink).text(line, cursor.g.left + 24, cursor.y, { width: cursor.g.width - 48 });
    cursor.y = doc.y + 9;
  }

  // 3. Introduction.
  chapterOpener("Introduction", book.introduction.title);
  book.introduction.sections.forEach((section, index) => writeSection(section, index === 0));

  // 4. Chapters.
  for (const chapter of book.chapters) {
    chapterOpener(`Chapter ${chapter.number}`, chapter.title, chapter.subtitle, chapter.epigraph);
    chapter.sections.forEach((section, index) => writeSection(section, index === 0));
    // Takeaways and the thing to try, in a tinted box.
    const g = cursor.g;
    const takeText = chapter.takeaways.map((line) => `•  ${line}`).join("\n");
    const boxHeight = heightOf(takeText, "body", 10.5, g.width - 28, 2.4) + heightOf(chapter.tryThis, "body", 10.5, g.width - 28, 2.4) + 78;
    if (g.bottom - cursor.y < Math.min(boxHeight, 300)) cursor = startPage();
    const c = cursor.g;
    const y0 = cursor.y + 10;
    const usable = c.bottom - y0;
    const h = Math.min(boxHeight, usable);
    doc.roundedRect(c.left, y0, c.width, h, 4).fill("#f3ece0");
    doc.font("sansBold").fontSize(8.5).fillColor(COLOURS.accent).text("KEY TAKEAWAYS", c.left + 14, y0 + 12, { characterSpacing: 1.4 });
    doc.font("body").fontSize(10.5).fillColor(COLOURS.ink).text(takeText, c.left + 14, doc.y + 4, { width: c.width - 28, lineGap: 2.4 });
    doc.font("sansBold").fontSize(8.5).fillColor(COLOURS.accent).text("TRY THIS WEEK", c.left + 14, doc.y + 10, { characterSpacing: 1.4 });
    doc.font("italic").fontSize(10.5).fillColor(COLOURS.ink).text(chapter.tryThis, c.left + 14, doc.y + 4, { width: c.width - 28, lineGap: 2.4 });
    cursor.y = Math.max(doc.y, y0 + h) + 12;
  }

  // 5. Conclusion and about the author.
  chapterOpener("Conclusion", book.conclusion.title);
  book.conclusion.sections.forEach((section, index) => writeSection(section, index === 0));
  chapterOpener("About the Author", book.author);
  for (const paragraph of book.aboutAuthor) writeParagraph(paragraph);

  decorateLater();
  // Pad to an even count and the KDP minimum with blank pages.
  const target = Math.max(MIN_PAGES, page + (page % 2));
  while (page < target) { addPage(); }
  void minInsideMargin; void BLEED;
  const pages = page;
  const pdf = await collect(doc);
  return { pdf, pages };
}

export type CoverArt = { data: Buffer; kind: "png" | "jpeg" } | null;

export async function renderCover(book: Book, pages: number, art: CoverArt): Promise<Buffer> {
  const size = coverSize(pages);
  const w = inch(size.width);
  const h = inch(size.height);
  const bleed = inch(BLEED);
  const trimW = inch(TRIM.width);
  const spine = inch(size.spine);
  const doc = newDoc(w, h);
  doc.info.Title = `${book.title} cover`;
  doc.addPage({ size: [w, h], margin: 0 });

  const frontX = bleed + trimW + spine;
  const backX = bleed;
  doc.rect(0, 0, w, h).fill(COLOURS.navy);

  // Front: art fills the cover; a dark scrim keeps the lettering readable.
  if (art) {
    try {
      doc.save().rect(frontX, 0, trimW + bleed, h).clip();
      doc.image(art.data, frontX, 0, { cover: [trimW + bleed, h], align: "center", valign: "center" });
      doc.restore();
      doc.save();
      doc.rect(frontX, 0, trimW + bleed, h).fillOpacity(0.35).fill("#000000");
      doc.restore();
    } catch {
      art = null;
    }
  }
  if (!art) {
    doc.rect(frontX, 0, trimW + bleed, h).fill(COLOURS.navy);
    doc.save().rect(frontX, 0, trimW + bleed, h).clip();
    doc.circle(frontX + trimW * 0.9, h * 0.22, 190).fillOpacity(0.14).fill(COLOURS.gold);
    doc.circle(frontX + trimW * 0.15, h * 0.85, 240).fillOpacity(0.10).fill(COLOURS.accent);
    doc.restore();
  }
  doc.fillOpacity(1);
  const safeLeft = frontX + inch(0.5);
  const safeWidth = trimW - inch(1.0);
  doc.font("sansBold").fontSize(9).fillColor(COLOURS.gold).text(book.tagline.toUpperCase(), safeLeft, inch(0.9), { width: safeWidth, align: "center", characterSpacing: 2 });
  doc.font("display").fontSize(book.title.length > 28 ? 36 : 46).fillColor(COLOURS.white).text(book.title, safeLeft, inch(2.2), { width: safeWidth, align: "center", lineGap: 2 });
  let y = doc.y + 12;
  doc.moveTo(safeLeft + safeWidth / 2 - 26, y).lineTo(safeLeft + safeWidth / 2 + 26, y).lineWidth(1.4).strokeColor(COLOURS.gold).stroke();
  doc.font("displayItalic").fontSize(16).fillColor("#f1e9d8").text(book.subtitle, safeLeft, y + 14, { width: safeWidth, align: "center" });
  doc.font("sansBold").fontSize(13).fillColor(COLOURS.white).text(book.author.toUpperCase(), safeLeft, h - inch(1.3), { width: safeWidth, align: "center", characterSpacing: 3 });

  // Spine (text only when thick enough for KDP).
  doc.rect(bleed + trimW, 0, spine, h).fill(COLOURS.navy);
  if (pages >= 79) {
    doc.save().translate(bleed + trimW + spine / 2, h / 2).rotate(90);
    doc.font("display").fontSize(15).fillColor(COLOURS.white).text(book.title, -inch(3.2), -8, { width: inch(5.2), align: "left", lineBreak: false });
    doc.font("sansBold").fontSize(9).fillColor(COLOURS.gold).text(book.author.toUpperCase(), inch(2.1), -5, { width: inch(1.2), align: "right", lineBreak: false, characterSpacing: 1.5 });
    doc.restore();
  }

  // Back: hook, promises, blurb, author, barcode space.
  doc.rect(0, 0, bleed + trimW, h).fill(COLOURS.navy);
  const bx = backX + inch(0.55);
  const bw = trimW - inch(1.1);
  doc.font("display").fontSize(19).fillColor(COLOURS.white).text(book.backCover.hook, bx, inch(0.8), { width: bw, lineGap: 2 });
  y = doc.y + 14;
  for (const bullet of book.backCover.bullets) {
    doc.font("body").fontSize(11).fillColor(COLOURS.gold).text("◆", bx, y, { width: 14, lineBreak: false });
    doc.font("body").fontSize(11).fillColor("#f1e9d8").text(bullet, bx + 18, y, { width: bw - 18, lineGap: 2 });
    y = doc.y + 6;
  }
  y += 8;
  doc.font("body").fontSize(10.5).fillColor("#e8e0cf").text(book.backCover.blurb, bx, y, { width: bw, lineGap: 3, align: "left" });
  y = doc.y + 14;
  if (book.backCover.quote) { doc.font("displayItalic").fontSize(12.5).fillColor(COLOURS.gold).text(`“${book.backCover.quote}”`, bx, y, { width: bw }); y = doc.y + 12; }
  doc.font("sansBold").fontSize(8).fillColor(COLOURS.gold).text("ABOUT THE AUTHOR", bx, y, { width: bw, characterSpacing: 1.5 });
  doc.font("body").fontSize(9.5).fillColor("#e8e0cf").text(book.backCover.authorBio, bx, doc.y + 4, { width: bw, lineGap: 2 });
  // Blank area KDP uses for its barcode: 2 x 1.2 in at the lower right of the back cover.
  doc.rect(backX + trimW - inch(2.55), h - bleed - inch(1.2) - inch(0.5), inch(2), inch(1.2)).fill(COLOURS.cream);

  return collect(doc);
}
