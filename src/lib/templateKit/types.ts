/**
 * templateKit — the generic "standard template + sample" layer every module uses (see the standing rule: every
 * module ships a sample data set, a one-click demo and a downloadable EMPTY template).
 *
 * A module describes its input once, as a KitDefinition: which sheets there are and what each field/column means.
 * From that single description the library produces
 *   • the blank template (with a generated "How to fill" guide),
 *   • the sample workbook (same layout, filled with fictional data, stamped with SAMPLE_MARKER), and
 *   • the reader that turns a filled workbook back into values — so the template, the guide and the importer can
 *     never disagree.
 *
 * Pure types: safe for client and server.
 */

export type Cell = string | number;

export type FieldType = 'text' | 'longtext' | 'number' | 'date' | 'select' | 'multiselect' | 'yesno';

export interface KitField {
  /** Stable machine key (e.g. a form-state key). The sheet shows `label`; the importer returns values by `key`. */
  key: string;
  label: string;
  /** "What to enter" — shown in the sheet and in the guide. */
  help: string;
  example?: string;
  required?: boolean;
  type?: FieldType;
  /** Allowed values for select / multiselect; listed in the sheet and the guide, and matched leniently on import. */
  options?: readonly string[];
  /** Section heading used to group fields in the guide. */
  group?: string;
}

/** One value per field: columns Field | Value | What to enter | Allowed values. */
export interface FieldsSheet {
  kind: 'fields';
  name: string;
  summary: string;
  fields: KitField[];
}

export interface TableColumn {
  key: string;
  header: string;
  help: string;
  type?: 'text' | 'number';
  required?: boolean;
  /** Excel column width in characters. */
  width?: number;
}

/** A table with a header row and any number of rows (statement lines, notes, …). */
export interface TableSheet {
  kind: 'table';
  name: string;
  summary: string;
  columns: TableColumn[];
  /** Rows shipped with the BLANK template too (e.g. the fixed line items of a balance sheet), keyed like content rows. */
  scaffold?: Record<string, Cell>[];
}

export type KitSheet = FieldsSheet | TableSheet;

export interface KitDefinition {
  id: string;
  /** Title line of the guide sheet, e.g. "Eccellere Business Context". */
  title: string;
  /** "Foundation › Business Context" */
  breadcrumb: string;
  /** Module-specific lines of guidance, added after the standard ones. */
  guidance: string[];
  sheets: KitSheet[];
  /** File name stem, e.g. "Eccellere-Business-Context". */
  fileBase: string;
  /** Who the workbook says made it (its Author property); Eccellere when absent. */
  author?: string;
}

/** Sheet name → field values (fields sheets) or rows (table sheets). */
export type KitContent = Record<string, Record<string, Cell> | Record<string, Cell>[]>;

export interface KitReadResult {
  /** Fields sheets: values by field key. Table sheets: rows by column key. Only sheets present in the file appear. */
  content: KitContent;
  /** The file carries SAMPLE_MARKER — it is one of our sample files and must be treated as a demo, never as real data. */
  isSample: boolean;
  /** Sheets in the file that are not part of this kit. */
  unknownSheets: string[];
  /** Plain-language notes: unrecognised select values, non-numeric cells, … (never fatal). */
  warnings: string[];
  /** Number of field values read, plus table rows that carry data (label-only scaffold rows do not count). */
  filled: number;
}
