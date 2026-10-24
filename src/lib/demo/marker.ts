/**
 * marker.ts — how the app tells a SAMPLE document from a real one.
 *
 * Demo data exists only so people can learn how a tool works. It must never be analysed, stored or benchmarked as
 * if it were the client's own company, because that would dilute their real analysis. Every sample file we publish
 * (the sample workbooks, the sample annual report, …) carries SAMPLE_MARKER in its text, and its file name starts
 * with SAMPLE_FILE_PREFIX. Any upload route that is about to analyse or save a document checks `isSampleText` first;
 * a hit means "show the demo result, save nothing".
 *
 * Pure (no DB, no React) so it can be used on the client and the server alike.
 */

/** Present, verbatim, in the text of every sample file. Do not reword — saved copies in the wild contain it. */
export const SAMPLE_MARKER = 'ECCELLERE-SAMPLE-DATA';

/** Sample files are named SAMPLE-….xlsx / SAMPLE-….docx so they are obvious in a downloads folder. */
export const SAMPLE_FILE_PREFIX = 'SAMPLE-';

/** The one-line wording used wherever a sample is shown, so the message is identical everywhere. */
export const SAMPLE_NOTICE =
  'SAMPLE DATA — a fictional company, shown for learning only. Nothing here is saved, and none of it is mixed into your own analysis.';

/** True when `text` (extracted from an uploaded file, or read from a workbook) came from one of our sample files. */
export function isSampleText(text: string | null | undefined): boolean {
  return typeof text === 'string' && text.includes(SAMPLE_MARKER);
}

/** True when a file name looks like one of our sample files (a hint only — the marker in the text is what counts). */
export function isSampleFileName(name: string | null | undefined): boolean {
  return typeof name === 'string' && name.trim().toUpperCase().startsWith(SAMPLE_FILE_PREFIX);
}

/** `Eccellere-Business-Context` + `Sample` → `SAMPLE-Eccellere-Business-Context.xlsx`; templates keep the plain name. */
export function kitFileName(base: string, variant: 'sample' | 'template'): string {
  return variant === 'sample' ? `${SAMPLE_FILE_PREFIX}${base}.xlsx` : `${base}-Template.xlsx`;
}
