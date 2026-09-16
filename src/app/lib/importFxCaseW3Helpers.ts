/**
 * Import FX W3 — pure helpers for advance / USD acquisition (no posting).
 * OD-1..OD-7 locked semantics.
 */

import type { ImportFxStageCode } from '@/app/lib/importFxCaseHelpers';

export type ImportFxW3FundingType = 'ADVANCE' | 'CREDIT' | 'MIXED';

export const W3_MIGRATION_NOT_INSTALLED =
  'W3 server migration is not installed in this environment.';

export const W3_CLEARING_HELP =
  'Used for actual PKR advances paid to FX agents. This account is separate from Agent Payable and Worker Advance.';

export function isW3MoneyStage(stageCode: ImportFxStageCode): boolean {
  return stageCode === 'ADVANCE' || stageCode === 'USD_ACQUISITION';
}

/** W4+ remain blocked in this wave. */
export function isPostW3MoneyStageBlocked(stageCode: ImportFxStageCode): boolean {
  return stageCode !== 'ARRANGEMENT' && !isW3MoneyStage(stageCode);
}

export function computeUsdCarryingPkr(usdQty: number, pkrPerUsd: number): number {
  if (!Number.isFinite(usdQty) || !Number.isFinite(pkrPerUsd) || usdQty <= 0 || pkrPerUsd <= 0) {
    return 0;
  }
  return Math.round(usdQty * pkrPerUsd * 100) / 100;
}

export function splitFundingAmounts(
  fundingType: ImportFxW3FundingType,
  carryingPkr: number,
  advanceAppliedPkr?: number | null
): { advanceAppliedPkr: number; agentApCreatedPkr: number } {
  const carry = Math.round((carryingPkr || 0) * 100) / 100;
  if (fundingType === 'CREDIT') return { advanceAppliedPkr: 0, agentApCreatedPkr: carry };
  if (fundingType === 'ADVANCE') return { advanceAppliedPkr: carry, agentApCreatedPkr: 0 };
  const applied = Math.round((advanceAppliedPkr || 0) * 100) / 100;
  const clamped = Math.max(0, Math.min(carry, applied));
  return {
    advanceAppliedPkr: clamped,
    agentApCreatedPkr: Math.round((carry - clamped) * 100) / 100,
  };
}

export type FifoAdvanceRow = {
  id: string;
  remaining_unapplied_pkr: number;
  posted_at?: string | null;
  created_at?: string | null;
};

/** FIFO oldest first; returns allocations summing to need (or less if insufficient). */
export function allocateAdvancesFifo(
  advances: FifoAdvanceRow[],
  needPkr: number
): { advance_id: string; applied_pkr: number }[] {
  const need = Math.round((needPkr || 0) * 100) / 100;
  if (need <= 0) return [];
  const sorted = [...advances].sort((a, b) => {
    const ta = Date.parse(a.posted_at || a.created_at || '') || 0;
    const tb = Date.parse(b.posted_at || b.created_at || '') || 0;
    return ta - tb;
  });
  let rem = need;
  const out: { advance_id: string; applied_pkr: number }[] = [];
  for (const row of sorted) {
    if (rem <= 0) break;
    const avail = Math.round((row.remaining_unapplied_pkr || 0) * 100) / 100;
    if (avail <= 0) continue;
    const take = Math.min(avail, rem);
    out.push({ advance_id: row.id, applied_pkr: take });
    rem = Math.round((rem - take) * 100) / 100;
  }
  return out;
}

export function buildAdvanceJournalPreview(args: {
  clearingLabel: string;
  paymentSourceLabel: string;
  amountPkr: number;
}): { lines: { side: 'Dr' | 'Cr'; account: string; amount: number }[]; balanced: boolean } {
  const amount = Math.round((args.amountPkr || 0) * 100) / 100;
  return {
    lines: [
      { side: 'Dr', account: args.clearingLabel, amount },
      { side: 'Cr', account: args.paymentSourceLabel, amount },
    ],
    balanced: amount > 0,
  };
}

export function buildUsdAcquisitionJournalPreview(args: {
  walletLabel: string;
  clearingLabel: string;
  agentApLabel: string;
  carryingPkr: number;
  advanceAppliedPkr: number;
  agentApCreatedPkr: number;
}): { lines: { side: 'Dr' | 'Cr'; account: string; amount: number }[]; balanced: boolean } {
  const carry = Math.round((args.carryingPkr || 0) * 100) / 100;
  const adv = Math.round((args.advanceAppliedPkr || 0) * 100) / 100;
  const ap = Math.round((args.agentApCreatedPkr || 0) * 100) / 100;
  const lines: { side: 'Dr' | 'Cr'; account: string; amount: number }[] = [
    { side: 'Dr', account: args.walletLabel, amount: carry },
  ];
  if (adv > 0) lines.push({ side: 'Cr', account: args.clearingLabel, amount: adv });
  if (ap > 0) lines.push({ side: 'Cr', account: args.agentApLabel, amount: ap });
  const cr = adv + ap;
  return { lines, balanced: carry > 0 && Math.round(cr * 100) / 100 === carry };
}

export function isEligibleClearingAccountCandidate(acc: {
  id?: string;
  code?: string | null;
  name?: string | null;
  type?: string | null;
  subtype?: string | null;
  is_group?: boolean | null;
  is_active?: boolean | null;
}): boolean {
  if (!acc?.id || acc.is_group || acc.is_active === false) return false;
  const code = String(acc.code || '').trim();
  const type = String(acc.type || '').toLowerCase();
  if (code === '1180' || ['1395', '2295', '6100', '7100'].includes(code)) return false;
  if (!['asset', 'current_asset'].includes(type) && type !== 'asset') {
    // allow asset enum variants
    if (type !== 'asset') return false;
  }
  const name = String(acc.name || '').toLowerCase();
  if (/\b(tt\b|t\/t|wallet)/i.test(name) && /^12/.test(code)) return false;
  return type === 'asset' || type === 'current_asset';
}
