/**
 * Journal-line liquidity detection for Transaction Trace (read-only).
 * Uses account type / name via shared isLiquidityPaymentAccount — not code-prefix regex alone.
 */

import { supabase } from '@/lib/supabase';
import { isLiquidityPaymentAccount } from '@/app/lib/liquidityPaymentAccount';
import type { JournalTraceRow } from '@/app/services/developerAccountingDiagnosticsService';

export function lineLooksLiquidityFromMetadata(line: {
  account_code?: string | null;
  account_name?: string | null;
  account_type?: string | null;
}): boolean {
  return isLiquidityPaymentAccount({
    code: line.account_code,
    name: line.account_name,
    type: line.account_type,
  });
}

export async function journalHasLiquidityLine(
  companyId: string,
  je: JournalTraceRow
): Promise<boolean> {
  const lines = je.lines || [];
  if (!lines.length) return false;

  const accountIds = [...new Set(lines.map((l) => l.account_id).filter(Boolean))];
  const typeByAccountId = new Map<string, string>();

  if (accountIds.length) {
    const { data } = await supabase
      .from('accounts')
      .select('id, code, name, type')
      .eq('company_id', companyId)
      .in('id', accountIds);
    for (const acc of data || []) {
      const row = acc as { id: string; code?: string; name?: string; type?: string };
      typeByAccountId.set(row.id, String(row.type || ''));
      if (isLiquidityPaymentAccount(row)) return true;
    }
  }

  for (const l of lines) {
    if (
      lineLooksLiquidityFromMetadata({
        account_code: l.account_code,
        account_name: l.account_name,
        account_type: typeByAccountId.get(l.account_id) ?? null,
      })
    ) {
      return true;
    }
  }

  return false;
}
