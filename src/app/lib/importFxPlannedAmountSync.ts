/**
 * Client-side planned amount sync for Import FX W2 Planned Currency cascade.
 * Planning-only — never posts journals. Uses indicative rates the operator can override.
 */

import { normalizeImportDocCurrency } from '@/app/lib/importFxHelpers';
import { rateToInputString } from '@/app/lib/importFxIndicativeRates';

export type PlannedAmountDriver = 'usd' | 'cny' | 'pkr';

export type PlannedAmountSyncInput = {
  sourceCurrency: string;
  settlementCurrency: string;
  driver: PlannedAmountDriver;
  plannedUsd: number | null;
  expectedCny: number | null;
  advancePkr: number | null;
  /** PKR per 1 USD */
  pkrPerUsd: number | null;
  /** CNY per 1 USD */
  cnyPerUsd: number | null;
  /** Optional PKR per 1 CNY (base display); falls back to pkrPerUsd/cnyPerUsd bridge */
  pkrPerCny?: number | null;
};

export type PlannedAmountSyncResult = {
  plannedUsd: string | null;
  expectedCny: string | null;
  advancePkr: string | null;
};

function pos(n: number | null | undefined): number | null {
  if (n == null) return null;
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return null;
  return v;
}

function roundAmount(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return NaN;
  if (n >= 1000) return Math.round(n * 100) / 100;
  if (n >= 1) return Math.round(n * 10000) / 10000;
  return Math.round(n * 1e6) / 1e6;
}

function asStr(n: number | null): string | null {
  if (n == null || !Number.isFinite(n) || n <= 0) return null;
  return rateToInputString(roundAmount(n)) || null;
}

function pkrPerCnyEffective(input: PlannedAmountSyncInput): number | null {
  const direct = pos(input.pkrPerCny);
  if (direct) return direct;
  const pkrPerUsd = pos(input.pkrPerUsd);
  const cnyPerUsd = pos(input.cnyPerUsd);
  if (pkrPerUsd && cnyPerUsd) return pkrPerUsd / cnyPerUsd;
  return null;
}

/**
 * Derive the other planned amounts from the last-edited driver using indicative rates.
 * Returns null for a field when it cannot be computed (missing rate/amount) so callers skip overwrite.
 */
export function syncPlannedAmounts(input: PlannedAmountSyncInput): PlannedAmountSyncResult {
  const source = normalizeImportDocCurrency(input.sourceCurrency);
  const settle = normalizeImportDocCurrency(input.settlementCurrency);
  const pkrPerUsd = pos(input.pkrPerUsd);
  const cnyPerUsd = pos(input.cnyPerUsd);
  const pkrPerCny = pkrPerCnyEffective(input);

  let usd = pos(input.plannedUsd);
  let cny = pos(input.expectedCny);
  let pkr = pos(input.advancePkr);

  const setFromUsd = (u: number) => {
    usd = u;
    if (cnyPerUsd) cny = u * cnyPerUsd;
    if (pkrPerUsd) pkr = u * pkrPerUsd;
  };

  const setFromCny = (c: number) => {
    cny = c;
    if (cnyPerUsd) usd = c / cnyPerUsd;
    if (pkrPerCny) pkr = c * pkrPerCny;
    else if (usd != null && pkrPerUsd) pkr = usd * pkrPerUsd;
  };

  const setFromPkr = (p: number) => {
    pkr = p;
    if (pkrPerUsd) {
      usd = p / pkrPerUsd;
      if (cnyPerUsd) cny = usd * cnyPerUsd;
    } else if (pkrPerCny) {
      cny = p / pkrPerCny;
      if (cnyPerUsd) usd = cny / cnyPerUsd;
    }
  };

  if (input.driver === 'usd' && usd != null) setFromUsd(usd);
  else if (input.driver === 'cny' && cny != null) setFromCny(cny);
  else if (input.driver === 'pkr' && pkr != null) setFromPkr(pkr);

  // When settle === source, settlement amount mirrors purchase; still fill the pair columns for draft.
  if (settle === source) {
    if (source === 'USD' && usd != null) {
      // keep usd; cny/pkr may still be filled for planning context
    } else if (source === 'CNY' && cny != null) {
      // keep cny
    }
  }

  const out: PlannedAmountSyncResult = {
    plannedUsd: null,
    expectedCny: null,
    advancePkr: null,
  };

  if (input.driver === 'usd') {
    out.expectedCny = asStr(cny);
    out.advancePkr = asStr(pkr);
  } else if (input.driver === 'cny') {
    out.plannedUsd = asStr(usd);
    out.advancePkr = asStr(pkr);
  } else {
    out.plannedUsd = asStr(usd);
    out.expectedCny = asStr(cny);
  }

  return out;
}

/**
 * Pick which fields to apply after sync, respecting amount-dirty locks.
 * Force replace (e.g. after Refresh rates) overwrites non-driver fields.
 */
export function pickSyncedAmountsToApply(params: {
  sync: PlannedAmountSyncResult;
  driver: PlannedAmountDriver;
  dirtyUsd: boolean;
  dirtyCny: boolean;
  dirtyPkr: boolean;
  forceReplace: boolean;
}): PlannedAmountSyncResult {
  const force = params.forceReplace === true;
  const allow = (field: PlannedAmountDriver, dirty: boolean) => {
    if (field === params.driver) return false; // never overwrite the driver from its own sync
    return force || !dirty;
  };
  return {
    plannedUsd: allow('usd', params.dirtyUsd) ? params.sync.plannedUsd : null,
    expectedCny: allow('cny', params.dirtyCny) ? params.sync.expectedCny : null,
    advancePkr: allow('pkr', params.dirtyPkr) ? params.sync.advancePkr : null,
  };
}

export const PLANNED_CURRENCY_PURCHASE_COPY =
  'What are you purchasing? Planning only — not financially posted.';

export const PLANNED_CURRENCY_SETTLE_COPY =
  'Convert / settle into which currency? Planning only — not financially posted.';

export const PLANNED_CURRENCY_NO_CONVERT_COPY = 'No conversion — keep in purchase currency.';
