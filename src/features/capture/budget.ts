/**
 * One helper for "this text is too long for one model call", so a cut is never silent: the caller gets what was dropped
 * and a plain-words note to show the person. Cuts at a paragraph or sentence boundary where it can.
 */
export type Fitted = { text: string; usedChars: number; totalChars: number; droppedChars: number; note: string | null };

export function fitToBudget(text: string, budget: number): Fitted {
  const totalChars = text.length;
  if (totalChars <= budget) return { text, usedChars: totalChars, totalChars, droppedChars: 0, note: null };
  let end = budget;
  const para = text.lastIndexOf("\n", budget);
  const sentence = text.lastIndexOf(". ", budget);
  const best = Math.max(para, sentence + 1);
  if (best > budget * 0.6) end = best;
  const kept = text.slice(0, end).trimEnd();
  const droppedChars = totalChars - kept.length;
  return { text: kept, usedChars: kept.length, totalChars, droppedChars, note: `Only the first ${kept.length.toLocaleString("en-IN")} of ${totalChars.toLocaleString("en-IN")} characters were used; ${droppedChars.toLocaleString("en-IN")} were left out.` };
}

/** Fits text and, when something is left out, says so inside the text itself so no reader is misled. */
export function fitMarked(text: string, budget: number): string {
  const fitted = fitToBudget(text, budget);
  return fitted.droppedChars ? `${fitted.text}
[Note: ${fitted.droppedChars} further characters of the source were not included here.]` : fitted.text;
}

/** Splits segments into batches under a character budget, with a visible cap on how many batches are read. */
export function batchByChars<T>(items: T[], size: (item: T) => number, budget: number, maxBatches: number): { batches: T[][]; readCount: number; total: number } {
  const batches: T[][] = [];
  let current: T[] = [];
  let used = 0;
  for (const item of items) {
    const s = size(item);
    if (current.length && used + s > budget) { batches.push(current); current = []; used = 0; }
    current.push(item);
    used += s;
  }
  if (current.length) batches.push(current);
  const kept = batches.slice(0, maxBatches);
  return { batches: kept, readCount: kept.reduce((n, b) => n + b.length, 0), total: items.length };
}
