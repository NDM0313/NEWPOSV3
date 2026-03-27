/**
 * Canonical opening-balance → GL posting (journal_entries + journal_entry_lines).
 * Idempotent per (reference_type, reference_id): one active JE; amount changes void prior and recreate.
 */

import { supabase } from '@/lib/supabase';
import { accountingService, type JournalEntry, type JournalEntryLine } from './accountingService';
import { accountService } from './accountService';
import { defaultAccountsService } from './defaultAccountsService';
import type { AccountCategory } from './chartAccountService';

export const OPENING_BALANCE_REFERENCE = {
  CONTACT_AR: 'opening_balance_contact_ar',
  CONTACT_AP: 'opening_balance_contact_ap',
  CONTACT_WORKER: 'opening_balance_contact_worker',
  GL_ACCOUNT: 'opening_balance_account',
  /** One active JE per opening stock_movements row (reference_id = movement id). Dr Inventory / Cr Equity. */
  INVENTORY_OPENING: 'opening_balance_inventory',
} as const;

const MONEY_EPS = 0.02;

function roundMoney(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function normalizeBranchId(branchId?: string | null): string | undefined {
  if (!branchId || branchId === 'all') return undefined;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(branchId)) return undefined;
  return branchId;
}

async function findAccountIdByCode(companyId: string, code: string): Promise<string | null> {
  const rows = await accountService.getAllAccounts(companyId);
  const c = code.trim();
  const hit = (rows || []).find((a: any) => String(a.code ?? '').trim() === c);
  return hit?.id ?? null;
}

/** Prefer 3000 Owner Capital / Capital; fallback first equity-type account. */
async function resolveOpeningEquityAccountId(companyId: string): Promise<string> {
  await defaultAccountsService.ensureDefaultAccounts(companyId);
  let id = await findAccountIdByCode(companyId, '3000');
  if (id) return id;
  const rows = await accountService.getAllAccounts(companyId);
  const t = (rows || []).find(
    (a: any) =>
      String(a.type ?? '').toLowerCase() === 'equity' &&
      /capital|owner|opening/i.test(String(a.name ?? ''))
  );
  if (t?.id) return t.id as string;
  const anyEq = (rows || []).find((a: any) => String(a.type ?? '').toLowerCase() === 'equity');
  if (anyEq?.id) return anyEq.id as string;
  throw new Error(
    'Opening balance equity account not found (expected code 3000 or an equity account). Run default account setup.'
  );
}

async function findActiveOpeningEntry(
  companyId: string,
  referenceType: string,
  referenceId: string
): Promise<{ id: string } | null> {
  const { data, error } = await supabase
    .from('journal_entries')
    .select('id')
    .eq('company_id', companyId)
    .eq('reference_type', referenceType)
    .eq('reference_id', referenceId)
    .or('is_void.is.null,is_void.eq.false')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error && error.code !== 'PGRST116') {
    console.warn('[openingBalanceJournalService] findActiveOpeningEntry:', error.message);
    return null;
  }
  return data?.id ? { id: data.id as string } : null;
}

async function voidJournalEntry(journalEntryId: string): Promise<void> {
  const { error } = await supabase
    .from('journal_entries')
    .update({ is_void: true, updated_at: new Date().toISOString() })
    .eq('id', journalEntryId);
  if (error) throw error;
}

/** Legacy: trigger posted stock_adjustment + expense; opening must use equity instead. */
async function voidMisclassifiedStockAdjustmentJesForMovement(movementId: string): Promise<void> {
  const { data: rows } = await supabase
    .from('journal_entries')
    .select('id')
    .eq('reference_type', 'stock_adjustment')
    .eq('reference_id', movementId)
    .or('is_void.is.null,is_void.eq.false');
  for (const r of rows || []) {
    await voidJournalEntry((r as { id: string }).id);
  }
}

async function resolveInventoryAssetAccountId(companyId: string): Promise<string | null> {
  await defaultAccountsService.ensureDefaultAccounts(companyId);
  let id = await findAccountIdByCode(companyId, '1200');
  if (id) return id;
  const rows = await accountService.getAllAccounts(companyId);
  const hit = (rows || []).find((a: any) => String(a.type ?? '').toLowerCase() === 'inventory');
  return hit?.id ?? null;
}

async function sumLineOnAccount(journalEntryId: string, accountId: string): Promise<{ debit: number; credit: number }> {
  const { data, error } = await supabase
    .from('journal_entry_lines')
    .select('debit, credit')
    .eq('journal_entry_id', journalEntryId)
    .eq('account_id', accountId);
  if (error || !data?.length) return { debit: 0, credit: 0 };
  let debit = 0;
  let credit = 0;
  data.forEach((l: any) => {
    debit += Number(l.debit) || 0;
    credit += Number(l.credit) || 0;
  });
  return { debit: roundMoney(debit), credit: roundMoney(credit) };
}

/**
 * If active JE exists and matches expected primary-account net (debit − credit), keep it.
 * Otherwise void and return false so caller creates a fresh JE.
 */
async function reconcileOrVoidOpeningJe(params: {
  companyId: string;
  referenceType: string;
  referenceId: string;
  primaryAccountId: string;
  /** Expected (debit − credit) on primary account for this opening */
  expectedPrimaryNet: number;
}): Promise<boolean> {
  const existing = await findActiveOpeningEntry(params.companyId, params.referenceType, params.referenceId);
  if (!existing) return false;
  const { debit, credit } = await sumLineOnAccount(existing.id, params.primaryAccountId);
  const net = roundMoney(debit - credit);
  if (Math.abs(net - roundMoney(params.expectedPrimaryNet)) <= MONEY_EPS) return true;
  await voidJournalEntry(existing.id);
  return false;
}

async function postBalancedOpening(params: {
  companyId: string;
  branchId?: string;
  referenceType: string;
  referenceId: string;
  description: string;
  lines: { account_id: string; debit: number; credit: number; description: string }[];
  entryDate: string;
  /** Optional stable entry_no (e.g. INV-OB-{movementPrefix}) */
  entryNo?: string;
}): Promise<void> {
  const totalDebit = roundMoney(params.lines.reduce((s, l) => s + l.debit, 0));
  const totalCredit = roundMoney(params.lines.reduce((s, l) => s + l.credit, 0));
  if (Math.abs(totalDebit - totalCredit) > MONEY_EPS) {
    throw new Error(`Opening balance JE not balanced: debit ${totalDebit} credit ${totalCredit}`);
  }
  if (totalDebit < MONEY_EPS && totalCredit < MONEY_EPS) return;

  const entry = {
    id: '',
    company_id: params.companyId,
    branch_id: params.branchId,
    entry_no: params.entryNo ?? `JE-OB-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    entry_date: params.entryDate.slice(0, 10),
    description: params.description,
    reference_type: params.referenceType,
    reference_id: params.referenceId,
  } as JournalEntry;

  const lines: JournalEntryLine[] = params.lines.map((l) => ({
    id: '',
    journal_entry_id: '',
    account_id: l.account_id,
    debit: l.debit,
    credit: l.credit,
    description: l.description,
  }));

  await accountingService.createEntry(entry, lines);
}

function openingEntryDate(): string {
  return new Date().toISOString().slice(0, 10);
}

async function syncWorkerOperationalBalance(workerContactId: string, amount: number): Promise<void> {
  const { error } = await supabase
    .from('workers')
    .update({ current_balance: roundMoney(amount), updated_at: new Date().toISOString() })
    .eq('id', workerContactId);
  if (error && import.meta.env?.DEV) {
    console.warn('[openingBalanceJournalService] workers.current_balance sync:', error.message);
  }
}

export const openingBalanceJournalService = {
  OPENING_BALANCE_REFERENCE,

  /**
   * Load contact from DB and post/void opening JEs for AR, AP, and worker legs as applicable.
   */
  async syncFromContactRow(contactId: string): Promise<void> {
    const { data: row, error } = await supabase
      .from('contacts')
      .select(
        'id, company_id, branch_id, type, name, opening_balance, supplier_opening_balance'
      )
      .eq('id', contactId)
      .maybeSingle();
    if (error || !row) {
      if (error) console.warn('[openingBalanceJournalService] syncFromContactRow load:', error.message);
      return;
    }

    const companyId = row.company_id as string;
    const branchId = normalizeBranchId(row.branch_id as string | null);
    const type = String(row.type || '').toLowerCase();
    const name = String((row as any).name || 'Contact');

    await defaultAccountsService.ensureDefaultAccounts(companyId);
    const equityId = await resolveOpeningEquityAccountId(companyId);
    const arId = await findAccountIdByCode(companyId, '1100');
    const apId = await findAccountIdByCode(companyId, '2000');
    const wpId = await findAccountIdByCode(companyId, '2010');
    const waId = await findAccountIdByCode(companyId, '1180');

    const entryDate = openingEntryDate();

    // --- Customer / both: AR from opening_balance
    if (type === 'customer' || type === 'both') {
      const raw = roundMoney(Number((row as any).opening_balance) || 0);
      if (Math.abs(raw) < MONEY_EPS) {
        const ex = await findActiveOpeningEntry(companyId, OPENING_BALANCE_REFERENCE.CONTACT_AR, contactId);
        if (ex) await voidJournalEntry(ex.id);
      } else if (arId) {
        const primaryNet = raw > 0 ? raw : -Math.abs(raw); // negative → credit AR
        const ok = await reconcileOrVoidOpeningJe({
          companyId,
          referenceType: OPENING_BALANCE_REFERENCE.CONTACT_AR,
          referenceId: contactId,
          primaryAccountId: arId,
          expectedPrimaryNet: primaryNet,
        });
        if (!ok) {
          const amt = Math.abs(raw);
          const lines =
            raw > 0
              ? [
                  { account_id: arId, debit: amt, credit: 0, description: 'Opening balance — receivable' },
                  { account_id: equityId, debit: 0, credit: amt, description: 'Opening balance — offset (Owner Capital)' },
                ]
              : [
                  { account_id: equityId, debit: amt, credit: 0, description: 'Opening balance — offset (Owner Capital)' },
                  { account_id: arId, debit: 0, credit: amt, description: 'Opening balance — receivable (credit)' },
                ];
          await postBalancedOpening({
            companyId,
            branchId,
            referenceType: OPENING_BALANCE_REFERENCE.CONTACT_AR,
            referenceId: contactId,
            description: `Opening balance — customer AR — ${name}`,
            lines,
            entryDate,
          });
        }
      }
    } else {
      const ex = await findActiveOpeningEntry(companyId, OPENING_BALANCE_REFERENCE.CONTACT_AR, contactId);
      if (ex) await voidJournalEntry(ex.id);
    }

    // --- Supplier / both: AP
    let apSource = 0;
    if (type === 'supplier' || type === 'both') {
      const supOb = (row as any).supplier_opening_balance;
      const ob = (row as any).opening_balance;
      if (type === 'supplier') {
        // Supplier-only: legacy rows may store payable opening in opening_balance
        apSource =
          supOb != null && supOb !== ''
            ? roundMoney(Number(supOb) || 0)
            : roundMoney(Number(ob) || 0);
      } else {
        apSource = roundMoney(Number(supOb) || 0);
      }
    }

    if (type === 'supplier' || type === 'both') {
      if (Math.abs(apSource) < MONEY_EPS) {
        const ex = await findActiveOpeningEntry(companyId, OPENING_BALANCE_REFERENCE.CONTACT_AP, contactId);
        if (ex) await voidJournalEntry(ex.id);
      } else if (apId) {
        // Payable positive = we owe supplier → Cr AP
        const primaryNet = apSource > 0 ? -apSource : Math.abs(apSource); // net on AP: Cr positive → credit − debit negative
        const ok = await reconcileOrVoidOpeningJe({
          companyId,
          referenceType: OPENING_BALANCE_REFERENCE.CONTACT_AP,
          referenceId: contactId,
          primaryAccountId: apId,
          expectedPrimaryNet: primaryNet,
        });
        if (!ok) {
          const amt = Math.abs(apSource);
          const lines =
            apSource > 0
              ? [
                  { account_id: equityId, debit: amt, credit: 0, description: 'Opening balance — offset (Owner Capital)' },
                  { account_id: apId, debit: 0, credit: amt, description: 'Opening balance — payable' },
                ]
              : [
                  { account_id: apId, debit: amt, credit: 0, description: 'Opening balance — payable (debit)' },
                  { account_id: equityId, debit: 0, credit: amt, description: 'Opening balance — offset (Owner Capital)' },
                ];
          await postBalancedOpening({
            companyId,
            branchId,
            referenceType: OPENING_BALANCE_REFERENCE.CONTACT_AP,
            referenceId: contactId,
            description: `Opening balance — supplier AP — ${name}`,
            lines,
            entryDate,
          });
        }
      }
    } else {
      const ex = await findActiveOpeningEntry(companyId, OPENING_BALANCE_REFERENCE.CONTACT_AP, contactId);
      if (ex) await voidJournalEntry(ex.id);
    }

    // --- Worker: opening_balance → 2010 payable if positive, 1180 advance if negative
    if (type === 'worker') {
      const wAmt = roundMoney(Number((row as any).opening_balance) || 0);
      await syncWorkerOperationalBalance(contactId, wAmt);

      if (Math.abs(wAmt) < MONEY_EPS) {
        const ex = await findActiveOpeningEntry(companyId, OPENING_BALANCE_REFERENCE.CONTACT_WORKER, contactId);
        if (ex) await voidJournalEntry(ex.id);
      } else {
        const usePayable = wAmt > 0;
        const primaryId = usePayable ? wpId : waId;
        if (!primaryId) {
          console.warn('[openingBalanceJournalService] Missing 2010/1180 for worker opening');
        } else {
          const primaryNet = usePayable ? -Math.abs(wAmt) : Math.abs(wAmt); // AP: Cr net negative as debit−credit
          const ok = await reconcileOrVoidOpeningJe({
            companyId,
            referenceType: OPENING_BALANCE_REFERENCE.CONTACT_WORKER,
            referenceId: contactId,
            primaryAccountId: primaryId,
            expectedPrimaryNet: primaryNet,
          });
          if (!ok) {
            const amt = Math.abs(wAmt);
            const lines = usePayable
              ? [
                  { account_id: equityId, debit: amt, credit: 0, description: 'Opening balance — offset (Owner Capital)' },
                  { account_id: primaryId, debit: 0, credit: amt, description: 'Opening balance — worker payable' },
                ]
              : [
                  { account_id: primaryId, debit: amt, credit: 0, description: 'Opening balance — worker advance' },
                  { account_id: equityId, debit: 0, credit: amt, description: 'Opening balance — offset (Owner Capital)' },
                ];
            await postBalancedOpening({
              companyId,
              branchId,
              referenceType: OPENING_BALANCE_REFERENCE.CONTACT_WORKER,
              referenceId: contactId,
              description: `Opening balance — worker — ${name}`,
              lines,
              entryDate,
            });
          }
        }
      }
    } else {
      const ex = await findActiveOpeningEntry(companyId, OPENING_BALANCE_REFERENCE.CONTACT_WORKER, contactId);
      if (ex) await voidJournalEntry(ex.id);
    }
  },

  /**
   * Post opening for a chart/GL account (cash/bank/wallet or any COA row).
   * @param amount — signed is not used; pass absolute opening; use isDebitNatural for direction from category.
   */
  async syncChartAccountOpening(params: {
    companyId: string;
    branchId?: string;
    accountId: string;
    accountCode?: string;
    accountName?: string;
    category: AccountCategory;
    openingAmount: number;
  }): Promise<void> {
    const amt = roundMoney(Math.abs(params.openingAmount));
    if (amt < MONEY_EPS) {
      const ex = await findActiveOpeningEntry(
        params.companyId,
        OPENING_BALANCE_REFERENCE.GL_ACCOUNT,
        params.accountId
      );
      if (ex) await voidJournalEntry(ex.id);
      return;
    }

    await defaultAccountsService.ensureDefaultAccounts(params.companyId);
    const equityId = await resolveOpeningEquityAccountId(params.companyId);
    const branchId = normalizeBranchId(params.branchId);

    const debitNatural =
      params.category === 'Assets' || params.category === 'Cost of Sales' || params.category === 'Expenses';

    const primaryNet = debitNatural ? amt : -amt;
    const ok = await reconcileOrVoidOpeningJe({
      companyId: params.companyId,
      referenceType: OPENING_BALANCE_REFERENCE.GL_ACCOUNT,
      referenceId: params.accountId,
      primaryAccountId: params.accountId,
      expectedPrimaryNet: primaryNet,
    });
    if (ok) return;

    const label = [params.accountCode, params.accountName].filter(Boolean).join(' — ') || params.accountId;
    const lines = debitNatural
      ? [
          { account_id: params.accountId, debit: amt, credit: 0, description: `Opening balance — ${label}` },
          { account_id: equityId, debit: 0, credit: amt, description: 'Opening balance — offset (Owner Capital)' },
        ]
      : [
          { account_id: equityId, debit: amt, credit: 0, description: 'Opening balance — offset (Owner Capital)' },
          { account_id: params.accountId, debit: 0, credit: amt, description: `Opening balance — ${label}` },
        ];

    await postBalancedOpening({
      companyId: params.companyId,
      branchId,
      referenceType: OPENING_BALANCE_REFERENCE.GL_ACCOUNT,
      referenceId: params.accountId,
      description: `Opening balance — account ${label}`,
      lines,
      entryDate: openingEntryDate(),
    });
  },

  /**
   * Canonical GL for `stock_movements` with reference_type = opening_balance.
   * Dr Inventory (1200 or type inventory) / Cr Owner Capital (3000). reference_id = movement id.
   * Voids active `stock_adjustment` JEs on the same movement (legacy wrong contra account).
   */
  async syncInventoryOpeningFromStockMovementId(movementId: string): Promise<void> {
    const { data: m, error } = await supabase.from('stock_movements').select('*').eq('id', movementId).maybeSingle();
    if (error || !m) {
      if (error) console.warn('[openingBalanceJournalService] syncInventoryOpening load movement:', error.message);
      return;
    }
    if (String(m.reference_type || '').toLowerCase().trim() !== 'opening_balance') return;
    if (String(m.movement_type || '').toLowerCase().trim() !== 'adjustment') return;

    const companyId = m.company_id as string;
    await voidMisclassifiedStockAdjustmentJesForMovement(movementId);

    const amt = roundMoney(
      Number(m.total_cost) || (Number(m.quantity) || 0) * (Number(m.unit_cost) || 0) || 0
    );

    const invId = await resolveInventoryAssetAccountId(companyId);
    if (!invId) {
      console.warn(
        '[openingBalanceJournalService] No inventory account (code 1200 or type inventory) for company',
        companyId
      );
      return;
    }

    await defaultAccountsService.ensureDefaultAccounts(companyId);
    const equityId = await resolveOpeningEquityAccountId(companyId);
    const branchId = normalizeBranchId(m.branch_id as string | null);
    const entryDate = String(m.created_at || new Date().toISOString()).slice(0, 10);

    if (amt < MONEY_EPS) {
      const ex = await findActiveOpeningEntry(companyId, OPENING_BALANCE_REFERENCE.INVENTORY_OPENING, movementId);
      if (ex) await voidJournalEntry(ex.id);
      return;
    }

    const ok = await reconcileOrVoidOpeningJe({
      companyId,
      referenceType: OPENING_BALANCE_REFERENCE.INVENTORY_OPENING,
      referenceId: movementId,
      primaryAccountId: invId,
      expectedPrimaryNet: amt,
    });
    if (ok) return;

    let productLabel = '';
    try {
      const { data: p } = await supabase.from('products').select('sku, name').eq('id', m.product_id).maybeSingle();
      if (p) productLabel = `${(p as { sku?: string }).sku || ''} ${(p as { name?: string }).name || ''}`.trim();
    } catch {
      /* ignore */
    }

    await postBalancedOpening({
      companyId,
      branchId,
      referenceType: OPENING_BALANCE_REFERENCE.INVENTORY_OPENING,
      referenceId: movementId,
      description: `Opening inventory${productLabel ? ` — ${productLabel}` : ''}`,
      lines: [
        { account_id: invId, debit: amt, credit: 0, description: 'Opening inventory (asset)' },
        { account_id: equityId, debit: 0, credit: amt, description: 'Opening inventory offset (Owner Capital)' },
      ],
      entryDate,
      entryNo: `INV-OB-${String(movementId).replace(/-/g, '').slice(0, 12)}`,
    });
  },
};
