/**
 * Amazon KDP paperback specifications this book is built to (checked against KDP's published print guidelines for a 6 x 9 inch
 * paperback; confirm against KDP's current page before publishing, since they change). Sizes are in inches, the PDF in points.
 */
export const PT = 72;
export const TRIM = { width: 6, height: 9 } as const;
export const BLEED = 0.125;
/** Paper thickness per page, in inches, for the spine: white and cream paper. */
export const PAPER = { white: 0.002252, cream: 0.0025 } as const;
export const MIN_PAGES = 24;
/** Spine text needs enough pages to be legible; KDP advises it from 79 pages. */
export const SPINE_TEXT_MIN_PAGES = 79;

/** The smallest inside (gutter) margin KDP allows for a page count. */
export function minInsideMargin(pages: number): number {
  return pages <= 150 ? 0.375 : pages <= 300 ? 0.5 : pages <= 500 ? 0.625 : pages <= 700 ? 0.75 : 0.875;
}

export type Paper = keyof typeof PAPER;

export const spineWidth = (pages: number, paper: Paper = "cream"): number => Number((pages * PAPER[paper]).toFixed(4));

/** The full cover (back, spine, front) including bleed, in inches. */
export function coverSize(pages: number, paper: Paper = "cream") {
  const spine = spineWidth(pages, paper);
  return { spine, width: Number((TRIM.width * 2 + spine + BLEED * 2).toFixed(4)), height: Number((TRIM.height + BLEED * 2).toFixed(4)) };
}

/** Margins for the interior, in inches. Generous, and always above KDP's minimum for the page count. */
export const INTERIOR_MARGINS = { inside: 0.8, outside: 0.6, top: 0.75, bottom: 0.8 } as const;
