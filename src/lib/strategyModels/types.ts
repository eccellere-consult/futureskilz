/**
 * strategyModels/types.ts — how a Strategy Hub framework is described, once, so that everything the client sees about it
 * is generated from one definition and cannot drift apart:
 *
 *   • the guided form (sections, typed fields, tables with computed columns, "results at a glance"),
 *   • the reference diagram of the industry-standard model,
 *   • the downloadable blank template and sample workbook, and the importer that reads a filled one back,
 *   • the structure the AI is asked to fill in and analyse,
 *   • the named outputs other tools take as input (the golden thread),
 *   • the worked example shown by the one-click demo.
 *
 * A definition's structure follows the real, published model — its canonical elements, in its canonical order, under its
 * canonical names. That is the point of this layer: the fields a client sees are the model's own, not a generic
 * "key challenges" box.
 *
 * Pure types (no database, no React): safe for the browser and the server alike.
 */
import type { StrategyActionable, StrategyAnalysis } from '../strategyFillinTypes';

/** One table row: column key → the cell's text. Numbers are kept as text and parsed where they are used. */
export type Row = Record<string, string>;

/** Everything a client has entered on a model: single values by field key, and table rows by table key. */
export interface ModelValues {
  fields: Record<string, string>;
  tables: Record<string, Row[]>;
}

export const EMPTY_VALUES: ModelValues = { fields: {}, tables: {} };

export type FieldType = 'text' | 'longtext' | 'select' | 'rating' | 'number';

/** Where a first draft of a field can come from — the hub's prefill order: Business Context → Value Scan → earlier tools → manual. */
export type Prefill = 'business_context' | 'value_scan' | { upstream: string; output: string };

export interface RatingScale {
  min: number;
  max: number;
  /** What the low and high ends mean, e.g. "weak" / "strong". */
  low: string;
  high: string;
}

export const DEFAULT_SCALE: RatingScale = { min: 1, max: 5, low: 'low', high: 'high' };

/** One value the client enters. */
export interface FieldPart {
  kind: 'field';
  /** Stable machine key; never shown. Saved answers are matched by `label`, so keep both stable. */
  key: string;
  /** The model's own name for this element, as the client sees it and as it is saved. */
  label: string;
  type: FieldType;
  /** What to enter — the model's definition of this element, in plain language. */
  help: string;
  /** An illustrative placeholder, shown greyed in the blank form. Never saved as an answer. */
  example: string;
  options?: readonly string[];
  scale?: RatingScale;
  unit?: string;
  prefill?: Prefill;
}

export type ColumnType = 'text' | 'longtext' | 'number' | 'select' | 'rating' | 'computed';

export interface Column {
  key: string;
  header: string;
  help: string;
  type: ColumnType;
  options?: readonly string[];
  scale?: RatingScale;
  unit?: string;
  /** In the card layout, two long-text columns marked `half` that follow one another sit side by side instead of one under the other. */
  half?: boolean;
  /** `computed` columns derive their text from the rest of the row (and the model's other values); they are not typed, saved or put in a template. */
  compute?: (row: Row, v: ModelValues) => string;
}

/** A grid the client fills in: one row per product line, per perspective, per activity, … */
export interface TablePart {
  kind: 'table';
  key: string;
  label: string;
  help: string;
  /** What one row is, e.g. "Product line" — used for the "Add a …" button. */
  rowLabel: string;
  columns: Column[];
  /** When the rows are the model's own (the nine value-chain activities), their names: the first column is then fixed text. */
  fixedRows?: readonly string[];
  /** For a fixed table: a line under each row's name saying what to consider there (row name → hint). Also a read-only column in the template. */
  rowHints?: Readonly<Record<string, string>>;
  /** Rows shown to start with (blank), and the most the table accepts. */
  minRows: number;
  maxRows: number;
  /** An illustrative row, shown greyed in the first blank row. */
  exampleRow?: Row;
  /** When present the table is drawn as a board of sticky notes (a fishbone, an affinity wall, an impact-effort grid); each row is one note. See boards.ts. */
  board?: BoardSpec;
}

export interface BoardAxis { label: string; low: string; high: string }

/**
 * How a table is drawn and edited as a board. The saved shape stays an ordinary table (Row[]): one row per note, so cleaning, the
 * content fingerprint, the Excel sheet, the importer, the AI prompt and `legacyLabels` all work unchanged. Every column named here
 * must be one of the table's own typed columns.
 */
export interface BoardSpec {
  /** 'regions': notes sit in named regions (the bones of a fishbone, an affinity group). 'grid': notes sit at an x/y position (impact-effort). */
  layout: 'regions' | 'grid';
  /** What one note is, for buttons and screen-reader text: 'cause', 'idea', 'fix'. */
  noteLabel: string;
  /** The text column that holds the note. */
  noteColumn: string;
  /** 'regions': the column holding the region. A select column gives the model's fixed regions; a text column with `freeRegions` lets the client invent groups. */
  regionColumn?: string;
  freeRegions?: { max: number };
  /** An optional select column drawn as the note's colour, and the tone each option takes. */
  statusColumn?: string;
  statusTones?: Record<string, Tone>;
  /** 'grid': the two rating columns, their axes and the four quadrant names (high x / high y first is not assumed: each names its own corner). */
  xColumn?: string;
  yColumn?: string;
  axes?: { x: BoardAxis; y: BoardAxis };
  quadrants?: { name: string; xHigh: boolean; yHigh: boolean }[];
  /** A soft limit for the editor, so a note stays a note; storage has no limit. */
  maxNoteChars: number;
}

export type Part = FieldPart | TablePart;

export interface Section {
  key: string;
  title: string;
  /** One line: what this part of the model asks. */
  summary: string;
  parts: Part[];
}

export type Tone = 'good' | 'warn' | 'bad' | 'neutral';

/** A figure worked out from the answers and shown beside the form as they type — "results at a glance". */
export interface Derived {
  key: string;
  label: string;
  help?: string;
  /** Null until there is enough input to compute it. */
  compute: (v: ModelValues) => string | null;
  tone?: (v: ModelValues) => Tone | undefined;
}

/** A named result other tools can take as input (the golden thread). */
export interface Output {
  key: string;
  label: string;
  compute: (v: ModelValues) => string | null;
  /** True when the result exists only on some paths (for example "the new direction, if pivoting"): absent is normal, not a gap. */
  conditional?: boolean;
}

export interface Reference {
  /** Who published the model, and where, e.g. "Michael E. Porter, Harvard Business Review". */
  originator: string;
  year: string;
  /** One or two sentences: what the model is and what it is for. */
  summary: string;
  /** The caption under the diagram. */
  caption: string;
  /** Two to four short lines on how to read the diagram. */
  howToRead: string[];
}

/**
 * A table of figures the model works out from the answers — a set of financial statements, a month-by-month projection. It is
 * shown beside the form and given to the AI, but never entered, saved or put in a template (the answers it comes from are).
 */
export interface ResultView {
  key: string;
  title: string;
  help?: string;
  /** The heading of the first column (what the rows are), e.g. "₹ lakh" or "Month". */
  rowHeading: string;
  /** The headings of the figure columns. */
  columns: readonly string[];
  /** The rows, by name. */
  rows: readonly string[];
  /** One figure of the table, as text; '' when it cannot be worked out yet. */
  cell: (row: string, column: string, v: ModelValues) => string;
  /** Rows shown in bold: totals and sub-totals. */
  strong?: readonly string[];
}

/** The part of a model a form, a template and an AI prompt need — every framework has one, canonical or generic. */
export interface Structure {
  sections: Section[];
  derived: Derived[];
  outputs: Output[];
  /** Tables of worked-out figures shown with the form (see ResultView). */
  views?: ResultView[];
}

export interface ModelDefinition extends Structure {
  toolId: string;
  reference: Reference;
  /** Saved answers from an earlier version of the tool: old label → the part key it now belongs to. */
  legacyLabels?: Record<string, string>;
  /** Extra guidance for the analysis AI: what this model's verdict should be, and how to reason to it. */
  analysisGuide: string;
}

/** A worked example for the one-click demo: filled-in answers, why each was chosen, and the analysis that follows. */
export interface ModelSample {
  /** One line placing the example: who, where, which situation. */
  scenario: string;
  values: Record<string, string>;
  tables: Record<string, Row[]>;
  /** Part key → one line on why this value was chosen. Shown beside the answer in the demo. */
  why: Record<string, string>;
  analysis: StrategyAnalysis;
  recommendations: string[];
  actionables: StrategyActionable[];
}

/** The name given to the fictional company in every sample. */
export const SAMPLE_COMPANY = 'Anand Auto Components Pvt Ltd';

export const isField = (p: Part): p is FieldPart => p.kind === 'field';
export const isTable = (p: Part): p is TablePart => p.kind === 'table';
