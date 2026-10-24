import "server-only";

import type { XlsxLoader } from "../sixSigma/ingest";

/**
 * Opening an uploaded workbook on the server (references/06 §3). Uploads are read with the vendored SheetJS 0.20.3, not with
 * xlsx-js-style (which carries the old SheetJS advisories), and only after a structural check: a file must look like a real
 * .xlsx (a zip with its end-of-directory record) or a real .xls (the OLE header) before SheetJS sees it. A tiny or truncated
 * zip was found on 18 October 2026 to keep SheetJS busy for many minutes; such a file is now refused at once.
 */

const ZIP_LOCAL_HEADER = [0x50, 0x4b, 0x03, 0x04];
const ZIP_END_OF_DIRECTORY = [0x50, 0x4b, 0x05, 0x06];
const OLE_HEADER = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
/** The end-of-directory record is 22 bytes plus a comment of at most 65,535 bytes. */
const END_RECORD_SEARCH = 22 + 65535;

const startsWith = (bytes: Uint8Array, signature: number[], at = 0) => signature.every((b, i) => bytes[at + i] === b);

function hasEndOfDirectory(bytes: Uint8Array): boolean {
  const stop = Math.max(0, bytes.length - END_RECORD_SEARCH);
  for (let at = bytes.length - 22; at >= stop; at -= 1) {
    if (startsWith(bytes, ZIP_END_OF_DIRECTORY, at)) return true;
  }
  return false;
}

/** True when the bytes are shaped like a workbook SheetJS can open: a complete zip (.xlsx) or an OLE file (.xls). */
export function looksLikeWorkbook(bytes: Uint8Array): boolean {
  if (bytes.length >= 512 && startsWith(bytes, OLE_HEADER)) return true;
  return bytes.length >= 22 + 30 && startsWith(bytes, ZIP_LOCAL_HEADER) && hasEndOfDirectory(bytes);
}

export class NotAWorkbookError extends Error {
  constructor() {
    super("That file is not a readable Excel workbook.");
    this.name = "NotAWorkbookError";
  }
}

/** The vendored SheetJS, loaded once. */
export const serverXlsx: XlsxLoader = async () => {
  const lib = await import("xlsx");
  return ((lib as unknown as { default?: typeof lib }).default ?? lib) as unknown as Awaited<ReturnType<XlsxLoader>>;
};

/** Checks the bytes, then hands back the loader; throws NotAWorkbookError for anything that is not a workbook. */
export function guardedServerXlsx(bytes: Uint8Array): XlsxLoader {
  if (!looksLikeWorkbook(bytes)) throw new NotAWorkbookError();
  return serverXlsx;
}
