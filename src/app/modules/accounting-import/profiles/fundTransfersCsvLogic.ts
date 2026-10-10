/**
 * Pure Fund Transfer CSV helpers (no Supabase) — parse, structural validate, direction flip.
 */

import { COA_HEADER_CODES } from '@/app/data/defaultCoASeed';
import { isLiquidityPaymentAccount } from '@/app/lib/liquidityPaymentAccount';
import type { CsvRowValidation } from '@/app/modules/csv-workbench/types';

export interface CoaLeafAccountLookup {
  id: string;
  code: string;
  name: string;
  type?: string | null;
  is_group?: boolean | null;
  is_active?: boolean | null;
}

export interface ParsedFundTransferRow {
  entry_date: string;
  amount: number;
  from_account_code: string;
  to_account_code: string;
  description?: string;
  external_ref?: string;
}

export type ParsedFundTransferRowWithIndex = ParsedFundTransferRow & {
  _sourceRowIndex: number;
};

export interface ResolvedFundTransferRow extends ParsedFundTransferRowWithIndex {
  fromAccountId: string;
  toAccountId: string;
  fromAccountName: string;
  toAccountName: string;
  amountFlipped?: boolean;
}

/** Accept YYYY-MM-DD, or slash/dash dates.
 * Unambiguous: day>12 → D/M/Y; month-slot>12 → M/D/Y.
 * Ambiguous (both ≤12): prefer M/D/Y (Excel cashbook exports like Zarposh).
 */
export function normalizeEntryDate(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(`${s}T12:00:00`);
    return Number.isNaN(d.getTime()) ? null : s;
  }
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    const yyyy = m[3]!;
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
    let day: number;
    let month: number;
    if (a > 12 && b <= 12) {
      day = a;
      month = b;
    } else if (b > 12 && a <= 12) {
      month = a;
      day = b;
    } else if (a <= 12 && b <= 12) {
      // Ambiguous — Excel exports commonly M/D/YYYY
      month = a;
      day = b;
    } else {
      return null;
    }
    const iso = `${yyyy}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const d = new Date(`${iso}T12:00:00`);
    return Number.isNaN(d.getTime()) ? null : iso;
  }
  return null;
}

export function parseSignedAmount(raw: string): number | null {
  const cleaned = raw.replace(/,/g, '').trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n === 0) return null;
  return Math.round(n * 100) / 100;
}

export function parseAmount(raw: string): number | null {
  const n = parseSignedAmount(raw);
  if (n == null || n <= 0) return null;
  return n;
}

export function looksLikeNonAccountCodeToken(code: string): boolean {
  const t = code.trim();
  if (!t) return false;
  if (/\s/.test(t)) return true;
  if (/[a-zA-Z]/.test(t) && !/\d/.test(t)) return true;
  return false;
}

export function accountTypeLooksEquityOrIncomeExpense(type: string | null | undefined): boolean {
  const t = String(type ?? '').toLowerCase();
  return (
    t.includes('equity') ||
    t.includes('revenue') ||
    t.includes('income') ||
    t.includes('expense') ||
    t.includes('cogs') ||
    t === 'drawing' ||
    t === 'drawings'
  );
}

export function normalizeTransferDirection(row: {
  amount: number;
  from_account_code: string;
  to_account_code: string;
}): {
  amount: number;
  from_account_code: string;
  to_account_code: string;
  amountFlipped: boolean;
} {
  const from = row.from_account_code.trim();
  const to = row.to_account_code.trim();
  if (row.amount < 0) {
    return {
      amount: Math.abs(row.amount),
      from_account_code: to,
      to_account_code: from,
      amountFlipped: true,
    };
  }
  return {
    amount: row.amount,
    from_account_code: from,
    to_account_code: to,
    amountFlipped: false,
  };
}

export function validateFundTransfersStructural(
  rows: ParsedFundTransferRowWithIndex[]
): CsvRowValidation[] {
  const out: CsvRowValidation[] = [];
  const seenExt = new Map<string, number>();

  for (const row of rows) {
    const ri = row._sourceRowIndex;
    const iso = normalizeEntryDate(row.entry_date);
    if (!iso) {
      out.push({
        rowIndex: ri,
        field: 'entry_date',
        severity: 'error',
        message: 'Invalid or missing entry_date (use YYYY-MM-DD or M/D/YYYY)',
      });
    }
    if (row.amount === 0 || !Number.isFinite(row.amount)) {
      out.push({
        rowIndex: ri,
        field: 'amount',
        severity: 'error',
        message: 'Amount must be a non-zero number (negative amounts flip from→to)',
      });
    }
    const fromRaw = row.from_account_code.trim();
    const toRaw = row.to_account_code.trim();
    if (!fromRaw) {
      out.push({
        rowIndex: ri,
        field: 'from_account_code',
        severity: 'error',
        message: 'from_account_code is required',
      });
    } else if (looksLikeNonAccountCodeToken(fromRaw)) {
      out.push({
        rowIndex: ri,
        field: 'from_account_code',
        severity: 'error',
        message: `"${fromRaw}" is not an account code — use a COA code (e.g. 1190)`,
      });
    }
    if (!toRaw) {
      out.push({
        rowIndex: ri,
        field: 'to_account_code',
        severity: 'error',
        message: 'to_account_code is required',
      });
    } else if (looksLikeNonAccountCodeToken(toRaw)) {
      out.push({
        rowIndex: ri,
        field: 'to_account_code',
        severity: 'error',
        message: `"${toRaw}" is not an account code — use a COA code (e.g. 1062)`,
      });
    }
    if (fromRaw && toRaw && fromRaw === toRaw) {
      out.push({
        rowIndex: ri,
        field: 'to_account_code',
        severity: 'error',
        message: 'From and to account codes must be different',
      });
    }
    const ext = (row.external_ref ?? '').trim();
    if (ext) {
      const prev = seenExt.get(ext);
      if (prev != null) {
        out.push({
          rowIndex: ri,
          field: 'external_ref',
          severity: 'error',
          message: `Duplicate external_ref "${ext}" (also on row ${prev})`,
        });
      } else {
        seenExt.set(ext, ri);
      }
    }
  }
  return out;
}

export function resolveCodeInMap(
  code: string,
  byCode: Map<string, CoaLeafAccountLookup>
): { ok: true; account: CoaLeafAccountLookup } | { ok: false; message: string } {
  const key = code.trim();
  if (!key) return { ok: false, message: 'Account code is empty' };
  if (looksLikeNonAccountCodeToken(key)) {
    return { ok: false, message: `"${key}" is not an account code — use a numeric COA code` };
  }
  if (COA_HEADER_CODES.has(key)) {
    return {
      ok: false,
      message: `Code ${key} is a COA section header — use a leaf account under that group`,
    };
  }
  const acc = byCode.get(key) ?? byCode.get(key.toLowerCase());
  if (!acc) {
    return {
      ok: false,
      message: `Account code "${key}" not found in Chart of Accounts (active leaf accounts)`,
    };
  }
  if (acc.is_group === true) {
    return { ok: false, message: `Account ${key} is a group — pick a leaf account` };
  }
  if (acc.is_active === false) {
    return { ok: false, message: `Account ${key} is inactive` };
  }
  return { ok: true, account: acc };
}

function pushNonLiquidityWarnings(
  validations: CsvRowValidation[],
  ri: number,
  field: 'from_account_code' | 'to_account_code',
  account: CoaLeafAccountLookup
): void {
  const isLiq = isLiquidityPaymentAccount(account);
  if (accountTypeLooksEquityOrIncomeExpense(account.type)) {
    validations.push({
      rowIndex: ri,
      field,
      severity: 'warning',
      message: `${account.code} (${account.name}) looks like ${String(account.type)} — not typical cash/bank/wallet; confirm before commit`,
    });
    return;
  }
  if (!isLiq) {
    validations.push({
      rowIndex: ri,
      field,
      severity: 'warning',
      message: `${account.code} is not cash/bank/wallet — payment backfill may skip; JE transfer still posts`,
    });
  }
}

export function validateAndResolveFundTransfers(
  rows: ParsedFundTransferRowWithIndex[],
  byCode: Map<string, CoaLeafAccountLookup>
): { resolved: ResolvedFundTransferRow[]; validations: CsvRowValidation[] } {
  const structural = validateFundTransfersStructural(rows);
  const validations = [...structural];
  const resolved: ResolvedFundTransferRow[] = [];
  const structuralErrorRows = new Set(
    structural.filter((v) => v.severity === 'error').map((v) => v.rowIndex)
  );

  for (const row of rows) {
    const ri = row._sourceRowIndex;
    if (structuralErrorRows.has(ri)) continue;

    const iso = normalizeEntryDate(row.entry_date)!;
    const dir = normalizeTransferDirection(row);

    if (dir.amountFlipped) {
      validations.push({
        rowIndex: ri,
        field: 'amount',
        severity: 'warning',
        message: `Amount was negative — will post as flipped ${dir.from_account_code}→${dir.to_account_code} (${dir.amount})`,
      });
    }

    if (dir.from_account_code === dir.to_account_code) {
      validations.push({
        rowIndex: ri,
        field: 'to_account_code',
        severity: 'error',
        message: 'From and to resolve to the same account after amount flip',
      });
      continue;
    }

    const fromRes = resolveCodeInMap(dir.from_account_code, byCode);
    const toRes = resolveCodeInMap(dir.to_account_code, byCode);

    if (!fromRes.ok) {
      validations.push({
        rowIndex: ri,
        field: 'from_account_code',
        severity: 'error',
        message: fromRes.message,
      });
    }
    if (!toRes.ok) {
      validations.push({
        rowIndex: ri,
        field: 'to_account_code',
        severity: 'error',
        message: toRes.message,
      });
    }
    if (!fromRes.ok || !toRes.ok) continue;

    if (fromRes.account.id === toRes.account.id) {
      validations.push({
        rowIndex: ri,
        field: 'to_account_code',
        severity: 'error',
        message: 'From and to resolve to the same account',
      });
      continue;
    }

    pushNonLiquidityWarnings(validations, ri, 'from_account_code', fromRes.account);
    pushNonLiquidityWarnings(validations, ri, 'to_account_code', toRes.account);

    resolved.push({
      ...row,
      entry_date: iso,
      amount: dir.amount,
      from_account_code: dir.from_account_code,
      to_account_code: dir.to_account_code,
      fromAccountId: fromRes.account.id,
      toAccountId: toRes.account.id,
      fromAccountName: fromRes.account.name,
      toAccountName: toRes.account.name,
      amountFlipped: dir.amountFlipped,
    });
  }

  return { resolved, validations };
}
