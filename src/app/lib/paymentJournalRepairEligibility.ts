/**
 * Pure eligibility helpers for payment / journal metadata repairs (Phase F3).
 */

import { isLiquidityPaymentAccount, type LiquidityAccountRef } from '@/app/lib/liquidityPaymentAccount';

const MONEY_EPS = 0.02;

export function amountsMatch(a: number | null | undefined, b: number | null | undefined): boolean {
  return Math.abs((Number(a) || 0) - (Number(b) || 0)) < MONEY_EPS;
}

export function datesClose(
  a: string | null | undefined,
  b: string | null | undefined,
  maxDays = 3
): boolean {
  if (!a || !b) return false;
  const da = new Date(String(a).slice(0, 10));
  const db = new Date(String(b).slice(0, 10));
  if (Number.isNaN(da.getTime()) || Number.isNaN(db.getTime())) return false;
  const diff = Math.abs(da.getTime() - db.getTime()) / (24 * 60 * 60 * 1000);
  return diff <= maxDays;
}

export interface LiquidityLineCandidate {
  accountId: string;
  debit: number;
  credit: number;
  amount: number;
  account: LiquidityAccountRef;
}

/** Exactly one liquidity line with movement matching expected amount. */
export function pickSingleLiquidityLine(
  lines: LiquidityLineCandidate[],
  expectedAmount: number | null | undefined
): LiquidityLineCandidate | null {
  const liquidity = lines.filter((l) => isLiquidityPaymentAccount(l.account));
  if (liquidity.length !== 1) return null;
  const line = liquidity[0];
  if (expectedAmount != null && !amountsMatch(line.amount, expectedAmount)) return null;
  return line;
}

export function blockCrossCompany(
  targetCompanyId: string | null | undefined,
  ctxCompanyId: string
): string | null {
  if (!targetCompanyId) return 'Missing company_id on target row';
  if (targetCompanyId !== ctxCompanyId) return 'Cross-company mismatch blocked';
  return null;
}

export function isVoided(row: { is_void?: boolean | null; voided_at?: string | null } | null): boolean {
  if (!row) return true;
  if (row.is_void === true) return true;
  if (row.voided_at) return true;
  return false;
}
