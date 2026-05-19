/**
 * Shared types for CSV import/export workbench (client-only).
 */

export type CsvEntityId = 'products' | 'contacts' | 'chart_of_accounts' | 'stock_adjustments';

export type CsvRowValidationSeverity = 'error' | 'warning';

/** 1-based CSV data row index (excluding header), for user-facing messages */
export interface CsvRowValidation {
  rowIndex: number;
  field?: string;
  severity: CsvRowValidationSeverity;
  message: string;
}

export interface ParsedCsv {
  /** Raw header cells as in file (trimmed) */
  headers: string[];
  /** Data rows only; each row same length as headers (padded with empty strings) */
  rows: string[][];
}

export interface CsvWorkbenchResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

/** Generic entity profile contract (products fully implemented; others stub). */
export interface CsvEntityProfile<TParsed = unknown> {
  id: CsvEntityId;
  displayName: string;
  /** Canonical export / template header order (snake_case keys as column titles) */
  canonicalHeaders: string[];
  /** Human-readable labels aligned 1:1 with canonicalHeaders (optional) */
  headerLabels?: string[];
  buildBlankTemplate(): string;
  parseFile(text: string): CsvWorkbenchResult<TParsed>;
  /** Stub profiles return not implemented */
  isImplemented: boolean;
}
