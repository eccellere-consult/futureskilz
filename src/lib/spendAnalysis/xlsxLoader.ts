/**
 * xlsxLoader.ts — lazy, single load of the spreadsheet library. xlsx-js-style is API-compatible with SheetJS
 * (same read/utils/write) and adds cell styling, so one library covers reading uploads, writing the styled
 * input template and writing the Excel tables export. Loaded on demand so the page itself stays light.
 */
type XlsxModule = typeof import('xlsx-js-style');

let cached: Promise<XlsxModule> | undefined;

export function loadXlsx(): Promise<XlsxModule> {
  cached ??= import('xlsx-js-style').then(m => ((m as unknown as { default?: XlsxModule }).default ?? m) as XlsxModule);
  return cached;
}
