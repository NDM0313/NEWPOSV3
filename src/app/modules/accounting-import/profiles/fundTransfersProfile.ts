/**
 * Fund Transfer CSV profile — parse, COA resolve, validate, dry-run, chunked commit.
 * Posts via createInternalTransferEntry (JE- + reference_type=transfer).
 *
 * Account resolve: all active leaf COA codes (not liquidity-only).
 * Negative amounts: abs + swap from/to (cashbook export pattern).
 */

import { COA_HEADER_CODES } from '@/app/data/defaultCoASeed';
import { parseCsvToStructured } from '@/app/modules/csv-workbench/parseCsv';
import { serializeCsvMatrix } from '@/app/modules/csv-workbench/serializeCsv';
import { runChunkedAllSettled } from '@/app/modules/csv-workbench/chunkedCommit';
import type { CsvRowValidation, CsvWorkbenchResult, ParsedCsv } from '@/app/modules/csv-workbench/types';
import { createInternalTransferEntry } from '@/app/services/addEntryV2Service';
import { accountService } from '@/app/services/accountService';
import {
  normalizeEntryDate,
  parseAmount,
  parseSignedAmount,
  looksLikeNonAccountCodeToken,
  accountTypeLooksEquityOrIncomeExpense,
  normalizeTransferDirection,
  validateFundTransfersStructural,
  validateAndResolveFundTransfers,
  type CoaLeafAccountLookup,
  type ParsedFundTransferRow,
  type ParsedFundTransferRowWithIndex,
  type ResolvedFundTransferRow,
} from './fundTransfersCsvLogic';

export type {
  CoaLeafAccountLookup,
  ParsedFundTransferRow,
  ParsedFundTransferRowWithIndex,
  ResolvedFundTransferRow,
};
export type LiquidityAccountLookup = CoaLeafAccountLookup;

export {
  normalizeEntryDate,
  parseAmount,
  parseSignedAmount,
  looksLikeNonAccountCodeToken,
  accountTypeLooksEquityOrIncomeExpense,
  normalizeTransferDirection,
  validateFundTransfersStructural,
  validateAndResolveFundTransfers,
};

/** Smaller chunks than products/contacts — sequential-friendly JE numbering + payment backfill. */
export const FUND_TRANSFER_IMPORT_CHUNK_SIZE = 4;

export const FUND_TRANSFER_CANONICAL_HEADERS = [
  'entry_date',
  'amount',
  'from_account_code',
  'to_account_code',
  'description',
  'external_ref',
] as const;

export const FUND_TRANSFER_CSV_HEADER_ALIASES: Record<string, string> = {
  entry_date: 'entry_date',
  date: 'entry_date',
  'entry date': 'entry_date',
  amount: 'amount',
  from_account_code: 'from_account_code',
  from_code: 'from_account_code',
  from: 'from_account_code',
  'from account': 'from_account_code',
  'from account code': 'from_account_code',
  to_account_code: 'to_account_code',
  to_code: 'to_account_code',
  to: 'to_account_code',
  'to account': 'to_account_code',
  'to account code': 'to_account_code',
  description: 'description',
  desc: 'description',
  notes: 'description',
  external_ref: 'external_ref',
  external_reference: 'external_ref',
  'external ref': 'external_ref',
  ref: 'external_ref',
  reference: 'external_ref',
};

export interface FundTransferImportRowError {
  rowIndex: number;
  label: string;
  message: string;
  type: 'validation' | 'failed' | 'skipped';
}

export interface FundTransferImportSummary {
  created: number;
  skipped: number;
  failed: number;
  errors: FundTransferImportRowError[];
  createdEntryNos: string[];
}

function buildHeaderIndexMap(headers: string[]): Record<string, number> {
  const colMap: Record<string, number> = {};
  headers.forEach((raw, i) => {
    const h = raw.trim().toLowerCase();
    const key = FUND_TRANSFER_CSV_HEADER_ALIASES[h] ?? h.replace(/\s+/g, '_');
    colMap[key] = i;
  });
  return colMap;
}

function cell(row: string[], colMap: Record<string, number>, key: string): string {
  const i = colMap[key];
  if (i == null) return '';
  return (row[i] ?? '').trim();
}

export function buildFundTransfersBlankTemplate(): string {
  const emptyRow = FUND_TRANSFER_CANONICAL_HEADERS.map(() => '');
  return serializeCsvMatrix([[...FUND_TRANSFER_CANONICAL_HEADERS], emptyRow]);
}

export function buildFundTransfersSampleTemplate(): string {
  return serializeCsvMatrix([
    [...FUND_TRANSFER_CANONICAL_HEADERS],
    ['2026-01-15', '50000', '1000', '1010', 'Cash to bank', 'EXT-001'],
    ['2026-01-16', '12000.50', '1010', '1020', 'Bank to wallet', 'EXT-002'],
  ]);
}

export function rowsFromParsedCsvWithIndices(parsed: ParsedCsv): ParsedFundTransferRowWithIndex[] {
  const colMap = buildHeaderIndexMap(parsed.headers);
  const out: ParsedFundTransferRowWithIndex[] = [];
  parsed.rows.forEach((row, i) => {
    const entry_date = cell(row, colMap, 'entry_date');
    const amountRaw = cell(row, colMap, 'amount');
    const from_account_code = cell(row, colMap, 'from_account_code');
    const to_account_code = cell(row, colMap, 'to_account_code');
    const description = cell(row, colMap, 'description') || undefined;
    const external_ref = cell(row, colMap, 'external_ref') || undefined;
    if (!entry_date && !amountRaw && !from_account_code && !to_account_code) return;
    const amount = parseSignedAmount(amountRaw) ?? 0;
    out.push({
      entry_date,
      amount,
      from_account_code,
      to_account_code,
      description,
      external_ref,
      _sourceRowIndex: i + 1,
    });
  });
  return out;
}

export function parseFundTransfersCsvFile(
  text: string
): CsvWorkbenchResult<{ parsed: ParsedCsv; rows: ParsedFundTransferRowWithIndex[] }> {
  const structured = parseCsvToStructured(text);
  if ('error' in structured) {
    return { ok: false, error: structured.error };
  }
  const required = ['entry_date', 'amount', 'from_account_code', 'to_account_code'];
  const colMap = buildHeaderIndexMap(structured.headers);
  const missing = required.filter((k) => colMap[k] == null);
  if (missing.length > 0) {
    return {
      ok: false,
      error: `Missing required column(s): ${missing.join(', ')}. Expected headers: ${FUND_TRANSFER_CANONICAL_HEADERS.join(', ')}`,
    };
  }
  const rows = rowsFromParsedCsvWithIndices(structured);
  return { ok: true, data: { parsed: structured, rows } };
}

function accountLabel(code: string, name?: string): string {
  return name ? `${code} (${name})` : code || '(empty)';
}

/**
 * Load all active leaf COA accounts for the company (exact code map).
 * Prefer this over liquidity-only for migration imports (e.g. 1190 / 1062).
 */
export async function loadLeafAccountMap(companyId: string): Promise<Map<string, CoaLeafAccountLookup>> {
  const list = await accountService.getAllAccounts(companyId);
  const map = new Map<string, CoaLeafAccountLookup>();
  for (const a of list || []) {
    if (a.is_active === false) continue;
    if (a.is_group === true) continue;
    const code = String(a.code ?? '').trim();
    if (!code) continue;
    if (COA_HEADER_CODES.has(code)) continue;
    const row: CoaLeafAccountLookup = {
      id: String(a.id),
      code,
      name: String(a.name ?? ''),
      type: a.type ?? null,
      is_group: a.is_group ?? false,
      is_active: a.is_active !== false,
    };
    map.set(code, row);
    const lower = code.toLowerCase();
    if (!map.has(lower)) map.set(lower, row);
  }
  return map;
}

/** @deprecated use loadLeafAccountMap */
export async function loadLiquidityAccountMap(companyId: string): Promise<Map<string, CoaLeafAccountLookup>> {
  return loadLeafAccountMap(companyId);
}

/** Dry run: resolve + validate only (no writes). */
export async function dryRunFundTransferImport(
  rows: ParsedFundTransferRowWithIndex[],
  companyId: string
): Promise<{
  resolved: ResolvedFundTransferRow[];
  validations: CsvRowValidation[];
  readyCount: number;
  errorCount: number;
  warningCount: number;
}> {
  const byCode = await loadLeafAccountMap(companyId);
  const { resolved, validations } = validateAndResolveFundTransfers(rows, byCode);
  const errorCount = validations.filter((v) => v.severity === 'error').length;
  const warningCount = validations.filter((v) => v.severity === 'warning').length;
  return { resolved, validations, readyCount: resolved.length, errorCount, warningCount };
}

export type FundTransferCommitOptions = {
  branchId?: string | null;
  createdBy?: string | null;
  onProgress?: (completed: number, total: number) => void;
};

export async function commitFundTransferImport(
  resolved: ResolvedFundTransferRow[],
  companyId: string,
  opts?: FundTransferCommitOptions
): Promise<FundTransferImportSummary> {
  const errors: FundTransferImportRowError[] = [];
  let created = 0;
  let failed = 0;
  const skipped = 0;
  const createdEntryNos: string[] = [];

  const total = resolved.length;
  opts?.onProgress?.(0, total);

  const settled = await runChunkedAllSettled(
    resolved,
    FUND_TRANSFER_IMPORT_CHUNK_SIZE,
    (row) =>
      createInternalTransferEntry({
        companyId,
        branchId: opts?.branchId ?? null,
        fromAccountId: row.fromAccountId,
        toAccountId: row.toAccountId,
        amount: row.amount,
        entryDate: row.entry_date,
        description: row.description ?? null,
        createdBy: opts?.createdBy ?? null,
        importMeta: {
          source: 'csv_import',
          externalRef: row.external_ref ?? null,
        },
      }),
    opts?.onProgress
  );

  let ri = 0;
  for (const s of settled) {
    const row = resolved[ri++]!;
    const label = `${row.from_account_code}→${row.to_account_code} ${row.amount}`;
    if (s.status === 'fulfilled') {
      created++;
      createdEntryNos.push(s.value.entryNo);
    } else {
      failed++;
      const msg =
        s.reason instanceof Error ? s.reason.message : String(s.reason ?? 'Unknown error');
      errors.push({
        rowIndex: row._sourceRowIndex,
        label,
        message: msg,
        type: 'failed',
      });
    }
  }

  return { created, skipped, failed, errors, createdEntryNos };
}

export function fundTransferRowToPreviewRecord(
  row: ResolvedFundTransferRow | ParsedFundTransferRowWithIndex
): Record<string, string | number> {
  const resolved = row as ResolvedFundTransferRow;
  return {
    entry_date: row.entry_date,
    amount: row.amount < 0 ? row.amount : resolved.amountFlipped ? resolved.amount : row.amount,
    from: resolved.fromAccountName
      ? accountLabel(row.from_account_code, resolved.fromAccountName)
      : row.from_account_code,
    to: resolved.toAccountName
      ? accountLabel(row.to_account_code, resolved.toAccountName)
      : row.to_account_code,
    description: row.description ?? '',
    external_ref: row.external_ref ?? '',
  };
}

/** Map validations (1-based CSV row) → 0-based preview index. */
export function rowErrorsMapForFundTransferPreview(
  rows: ParsedFundTransferRowWithIndex[],
  validations: CsvRowValidation[]
): Map<number, CsvRowValidation[]> {
  const bySource = new Map<number, CsvRowValidation[]>();
  for (const v of validations) {
    const list = bySource.get(v.rowIndex) ?? [];
    list.push(v);
    bySource.set(v.rowIndex, list);
  }
  const out = new Map<number, CsvRowValidation[]>();
  rows.forEach((row, i) => {
    const list = bySource.get(row._sourceRowIndex);
    if (list?.length) out.set(i, list);
  });
  return out;
}
