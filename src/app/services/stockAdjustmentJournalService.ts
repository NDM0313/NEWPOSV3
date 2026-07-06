/**
 * Canonical GL for generic stock adjustments (reference_type stock_adjustment on stock_movements).
 * Repairs zero-amount trigger JEs and posts balanced Dr Inventory / Cr expense when cost is known.
 */

import { supabase } from '@/lib/supabase';
import { accountingService, type JournalEntry, type JournalEntryLine } from './accountingService';
import { accountService } from './accountService';
import { defaultAccountsService } from './defaultAccountsService';
import {
  roundStockMoney,
  resolveStockMovementValuation,
  STOCK_MONEY_EPS,
} from '@/app/utils/stockMovementValuation';

function normalizeBranchId(branchId?: string | null): string | undefined {
  if (!branchId || branchId === 'all') return undefined;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(branchId)) {
    return undefined;
  }
  return branchId;
}

async function voidJournalEntry(journalEntryId: string): Promise<void> {
  const { error } = await supabase
    .from('journal_entries')
    .update({ is_void: true, updated_at: new Date().toISOString() })
    .eq('id', journalEntryId);
  if (error) throw error;
}

async function findActiveStockAdjustmentJe(movementId: string): Promise<{ id: string; entry_no?: string } | null> {
  const { data, error } = await supabase
    .from('journal_entries')
    .select('id, entry_no')
    .eq('reference_type', 'stock_adjustment')
    .eq('reference_id', movementId)
    .or('is_void.is.null,is_void.eq.false')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error && error.code !== 'PGRST116') {
    console.warn('[stockAdjustmentJournalService] findActiveStockAdjustmentJe:', error.message);
    return null;
  }
  return data?.id ? { id: data.id as string, entry_no: (data as { entry_no?: string }).entry_no } : null;
}

async function sumJeLineAmounts(journalEntryId: string): Promise<number> {
  const totals = await sumJeLineTotals(journalEntryId);
  return totals.maxSide;
}

async function sumJeLineTotals(
  journalEntryId: string
): Promise<{ debits: number; credits: number; maxSide: number; balanced: boolean }> {
  const { data, error } = await supabase
    .from('journal_entry_lines')
    .select('debit, credit')
    .eq('journal_entry_id', journalEntryId);
  if (error || !data?.length) {
    return { debits: 0, credits: 0, maxSide: 0, balanced: true };
  }
  const debits = roundStockMoney(
    data.reduce((s, l) => s + (Number((l as { debit?: number }).debit) || 0), 0)
  );
  const credits = roundStockMoney(
    data.reduce((s, l) => s + (Number((l as { credit?: number }).credit) || 0), 0)
  );
  return {
    debits,
    credits,
    maxSide: roundStockMoney(Math.max(debits, credits)),
    balanced: Math.abs(debits - credits) <= STOCK_MONEY_EPS,
  };
}

async function resolveInventoryAssetAccountId(companyId: string): Promise<string | null> {
  await defaultAccountsService.ensureDefaultAccounts(companyId);
  const rows = await accountService.getAllAccounts(companyId);
  const byCode = (rows || []).find((a: { code?: string }) => String(a.code ?? '').trim() === '1200');
  if (byCode?.id) return byCode.id;
  const byType = (rows || []).find(
    (a: { type?: string }) => String(a.type ?? '').toLowerCase() === 'inventory'
  );
  return byType?.id ?? null;
}

async function resolveAdjustmentExpenseAccountId(companyId: string): Promise<string | null> {
  await defaultAccountsService.ensureDefaultAccounts(companyId);
  const rows = await accountService.getAllAccounts(companyId);
  const codes = new Set(['5000', '5100', '5110', '5120', '6000', '6100']);
  const byCode = (rows || []).find((a: { code?: string; is_active?: boolean }) => {
    const c = String(a.code ?? '').trim();
    return codes.has(c) && a.is_active !== false;
  });
  if (byCode?.id) return byCode.id;
  const byType = (rows || []).find((a: { type?: string; is_active?: boolean }) => {
    const t = String(a.type ?? '').toLowerCase();
    return (t === 'expense' || t === 'cost') && a.is_active !== false;
  });
  return byType?.id ?? null;
}

function buildStockAdjustmentLines(
  amount: number,
  inventoryAccountId: string,
  adjustmentAccountId: string,
  notes: string,
  signedQty: number
): { account_id: string; debit: number; credit: number; description: string }[] {
  const amt = roundStockMoney(Math.abs(amount));
  const vNotes = notes || 'Stock adjustment';
  if (signedQty >= 0) {
    return [
      {
        account_id: inventoryAccountId,
        debit: amt,
        credit: 0,
        description: `Inventory increase - ${vNotes}`,
      },
      {
        account_id: adjustmentAccountId,
        debit: 0,
        credit: amt,
        description: `Stock adjustment - ${vNotes}`,
      },
    ];
  }
  return [
    {
      account_id: adjustmentAccountId,
      debit: amt,
      credit: 0,
      description: `Stock adjustment - ${vNotes}`,
    },
    {
      account_id: inventoryAccountId,
      debit: 0,
      credit: amt,
      description: `Inventory decrease - ${vNotes}`,
    },
  ];
}

async function postStockAdjustmentJe(params: {
  companyId: string;
  branchId?: string;
  movementId: string;
  signedQty: number;
  amount: number;
  notes: string;
  entryDate: string;
  entryNo?: string;
}): Promise<string | null> {
  const invId = await resolveInventoryAssetAccountId(params.companyId);
  const adjId = await resolveAdjustmentExpenseAccountId(params.companyId);
  if (!invId || !adjId) {
    console.warn(
      '[stockAdjustmentJournalService] Missing inventory or adjustment account for company',
      params.companyId
    );
    return null;
  }

  const lines = buildStockAdjustmentLines(
    params.amount,
    invId,
    adjId,
    params.notes,
    params.signedQty
  );
  const totalDebit = roundStockMoney(lines.reduce((s, l) => s + l.debit, 0));
  if (totalDebit < STOCK_MONEY_EPS) return null;

  const entryNo =
    params.entryNo ||
    `ADJ-${params.entryDate.replace(/-/g, '')}-${String(params.movementId).replace(/-/g, '').slice(0, 8)}`;

  const entry: JournalEntry = {
    id: '',
    company_id: params.companyId,
    branch_id: params.branchId,
    entry_no: entryNo,
    entry_date: params.entryDate.slice(0, 10),
    description: `Stock adjustment: ${params.notes || 'Stock adjustment'}`,
    reference_type: 'stock_adjustment',
    reference_id: params.movementId,
  };

  const journalLines: JournalEntryLine[] = lines.map((l) => ({
    id: '',
    journal_entry_id: '',
    account_id: l.account_id,
    debit: l.debit,
    credit: l.credit,
    description: l.description,
  }));

  const saved = await accountingService.createEntry(entry, journalLines);
  return String((saved as { id?: string })?.id || '') || null;
}

export const stockAdjustmentJournalService = {
  async syncStockAdjustmentFromMovementId(
    movementId: string,
    opts?: { suppressNotify?: boolean }
  ): Promise<{ posted: boolean; kept: boolean; skippedZeroCost: boolean; amount: number }> {
    const SKIP = { posted: false, kept: false, skippedZeroCost: false, amount: 0 };
    const { data: m, error } = await supabase
      .from('stock_movements')
      .select('*')
      .eq('id', movementId)
      .maybeSingle();
    if (error || !m) {
      if (error) console.warn('[stockAdjustmentJournalService] load movement:', error.message);
      return SKIP;
    }

    const ref = String(m.reference_type || '').toLowerCase().trim();
    if (ref === 'opening_balance') return SKIP;

    const mt = String(m.movement_type || (m as { type?: string }).type || '')
      .toLowerCase()
      .trim();
    if (mt !== 'adjustment') return SKIP;

    const valuation = await resolveStockMovementValuation(m);
    let amt = valuation.amount;

    if (valuation.usedProductFallback && amt > STOCK_MONEY_EPS) {
      await supabase
        .from('stock_movements')
        .update({
          unit_cost: valuation.unitCost,
          total_cost: amt,
        })
        .eq('id', movementId);
    }

    const existing = await findActiveStockAdjustmentJe(movementId);
    const signedQty = Number(m.quantity) || 0;

    if (amt < STOCK_MONEY_EPS) {
      if (existing) await voidJournalEntry(existing.id);
      if (!opts?.suppressNotify) {
        try {
          const { notifyAccountingEntriesChanged } = await import('@/app/lib/accountingInvalidate');
          notifyAccountingEntriesChanged();
        } catch {
          /* ignore */
        }
      }
      return { posted: false, kept: false, skippedZeroCost: true, amount: 0 };
    }

    if (existing) {
      const lineTotals = await sumJeLineTotals(existing.id);
      if (
        lineTotals.balanced &&
        Math.abs(lineTotals.maxSide - amt) <= STOCK_MONEY_EPS &&
        lineTotals.maxSide >= STOCK_MONEY_EPS
      ) {
        if (!opts?.suppressNotify) {
          try {
            const { notifyAccountingEntriesChanged } = await import('@/app/lib/accountingInvalidate');
            notifyAccountingEntriesChanged();
          } catch {
            /* ignore */
          }
        }
        return { posted: false, kept: true, skippedZeroCost: false, amount: amt };
      }
      await voidJournalEntry(existing.id);
    }

    const companyId = m.company_id as string;
    const branchId = normalizeBranchId(m.branch_id as string | null);
    const entryDate = String(m.created_at || new Date().toISOString()).slice(0, 10);
    const notes = String(m.notes || 'Stock adjustment');

    const postedJeId = await postStockAdjustmentJe({
      companyId,
      branchId,
      movementId,
      signedQty,
      amount: amt,
      notes,
      entryDate,
      entryNo: existing?.entry_no,
    });

    if (!opts?.suppressNotify) {
      try {
        const { notifyAccountingEntriesChanged } = await import('@/app/lib/accountingInvalidate');
        const jeId = postedJeId || (await findActiveStockAdjustmentJe(movementId))?.id || null;
        notifyAccountingEntriesChanged({
          companyId,
          branchId: branchId ?? null,
          entityId: jeId,
          reason: 'accounting-entries-changed',
        });
      } catch {
        /* ignore */
      }
    }
    return { posted: true, kept: false, skippedZeroCost: false, amount: amt };
  },

  async repairZeroAmountStockAdjustmentsForCompany(
    companyId: string,
    opts?: { suppressNotify?: boolean }
  ): Promise<{ repaired: number; skipped: number; failed: number }> {
    const result = { repaired: 0, skipped: 0, failed: 0 };
    if (!companyId) return result;

    const { data: jes, error } = await supabase
      .from('journal_entries')
      .select('id, reference_id')
      .eq('company_id', companyId)
      .eq('reference_type', 'stock_adjustment')
      .or('is_void.is.null,is_void.eq.false');
    if (error) {
      console.warn('[stockAdjustmentJournalService] repair list:', error.message);
      return result;
    }

    for (const je of jes || []) {
      const movementId = (je as { reference_id?: string }).reference_id;
      if (!movementId) {
        result.skipped++;
        continue;
      }
      const lineTotal = await sumJeLineAmounts((je as { id: string }).id);
      if (lineTotal >= STOCK_MONEY_EPS) {
        result.skipped++;
        continue;
      }
      try {
        const sync = await this.syncStockAdjustmentFromMovementId(String(movementId), {
          suppressNotify: true,
        });
        if (sync.posted || sync.kept) result.repaired++;
        else result.skipped++;
      } catch (e) {
        console.warn('[stockAdjustmentJournalService] repair failed for movement', movementId, e);
        result.failed++;
      }
    }

    if (!opts?.suppressNotify && result.repaired > 0) {
      try {
        const { notifyAccountingEntriesChanged } = await import('@/app/lib/accountingInvalidate');
        notifyAccountingEntriesChanged();
      } catch {
        /* ignore */
      }
    }
    return result;
  },
};
