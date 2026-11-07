"use client";

/**
 * Reads the text of a PDF inside the person's own browser. The website's server cannot always start its own PDF reader on
 * the host, and the browser always can, so PDFs are read here and only their text is sent. Nothing is read from a scan or from
 * slides saved as pictures: those pages come back empty and the caller says so.
 */
export type PdfPages = { pages: Array<{ num: number; text: string }>; checksum: string };

/** A PDF this big is left to the file store alone: reading it in a browser tab could run the device out of memory. */
export const MAX_BROWSER_PDF_BYTES = 150 * 1024 * 1024;

async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function readPdfPages(file: File, onProgress?: (page: number, of: number) => void): Promise<PdfPages> {
  const pdfjs = await import("pdfjs-dist");
  // The reader's helper script is served from this site's own public folder (a copy kept equal to the installed version by a test).
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const buffer = await file.arrayBuffer();
  const checksum = await sha256Hex(buffer);
  // The reader takes ownership of the bytes it is given, so it gets a copy and the checksum above stays valid.
  const document = await pdfjs.getDocument({ data: new Uint8Array(buffer.slice(0)) }).promise;
  const pages: PdfPages["pages"] = [];
  try {
    for (let num = 1; num <= document.numPages; num += 1) {
      onProgress?.(num, document.numPages);
      const page = await document.getPage(num);
      const content = await page.getTextContent();
      let text = "";
      for (const item of content.items) {
        if (!("str" in item)) continue;
        text += item.str;
        text += item.hasEOL ? "\n" : " ";
      }
      page.cleanup();
      pages.push({ num, text: text.replace(/[ \t]+\n/g, "\n").replace(/[ \t]{2,}/g, " ").trim() });
    }
  } finally {
    await document.destroy();
  }
  return { pages, checksum };
}
