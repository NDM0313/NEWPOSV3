/**
 * Party-level ledger discount (wholesale GL): customer AR reduction or supplier AP reduction
 * with standard COA discount accounts 5200 / 5210.
 */

import { supabase } from '@/lib/supabase';
import { COA_CODES } from '@/app/config/coaMapping';
import { accountHelperService } from '@/app/services/accountHelperService';
import {
  accountingService,
  type JournalEntry,
  type JournalEntryLine,
} from '@/app/services/accountingService';
import { documentNumberService } from '@/app/services/documentNumberService';
import {
  resolvePayablePostingAccountId,
  resolveReceivablePostingAccountId,
} from '@/app/services/partySubledgerAccountService';

export type PartyLedgerDiscountType = 'customer' | 'supplier';

export interface PostPartyLedgerDiscountParams {
  companyId: string;
  branchId?: string | null;
  partyType: PartyLedgerDiscountType;
  contactId: string;
  partyName: string;
  amount: number;
  entryDate: string;
  description?: string;
  createdBy?: string | null;
}

async function ensureDiscountAllowedAccount(companyId: string): Promise<string | null> {
  const existing = await accountHelperService.getAccountByCode(COA_CODES.DISCOUNT_ALLOWED, companyId);
  if (existing?.id) return existing.id;
  try {
    const { data, error } = await supabase
      .from('accounts')
      .insert({
        company_id: companyId,
        code: COA_CODES.DISCOUNT_ALLOWED,
        name: 'Discount Allowed',
        type: 'Expense',
        balance: 0,
        is_active: true,
      })
      .select('id')
      .single();
    if (!error && data?.id) return String(data.id);
  } catch (e) {
    console.warn('[partyLedgerDiscountService] Could not auto-create Discount Allowed:', e);
  }
  return null;
}

async function resolveDiscountReceivedAccountId(companyId: string): Promise<string | null> {
  const byCode = await accountHelperService.getAccountByCode(COA_CODES.DISCOUNT_RECEIVED, companyId);
  if (byCode?.id) return byCode.id;
  const { data: discRows } = await supabase
    .from('accounts')
    .select('id, code')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .or('code.eq.5210,name.ilike.%Discount Received%,name.ilike.%Purchase Discount%');
  const list = (discRows || []) as { id: string; code: string }[];
  return list.find((a) => a.code === COA_CODES.DISCOUNT_RECEIVED)?.id ?? list[0]?.id ?? null;
}

function partyDiscountFingerprint(
  companyId: string,
  partyType: PartyLedgerDiscountType,
  contactId: string,
  entryDate: string,
  amount: number
): string {
  const d = entryDate.slice(0, 10);
  const amt = Math.round(amount * 100) / 100;
  return `party_discount:${companyId}:${partyType}:${contactId}:${d}:${amt}`;
}

export async function postPartyLedgerDiscount(
  params: PostPartyLedgerDiscountParams
): Promise<{ journalEntryId: string | null; skipped: boolean; error?: string }> {
  const {
    companyId,
    branchId,
    partyType,
    contactId,
    partyName,
    amount,
    entryDate,
    description,
    createdBy,
  } = params;

  const amt = Math.round((Number(amount) || 0) * 100) / 100;
  if (!companyId || !contactId || amt <= 0) {
    return { journalEntryId: null, skipped: true, error: 'Invalid discount amount or party.' };
  }

  const dateStr = entryDate.slice(0, 10);
  const fp = partyDiscountFingerprint(companyId, partyType, contactId, dateStr, amt);

  const { data: dup } = await supabase
    .from('journal_entries')
    .select('id')
    .eq('company_id', companyId)
    .eq('action_fingerprint', fp)
    .or('is_void.is.null,is_void.eq.false')
    .maybeSingle();
  if (dup?.id) {
    return { journalEntryId: String((dup as { id: string }).id), skipped: true };
  }

  const branchSafe = branchId && branchId !== 'all' ? branchId : undefined;
  const baseDesc =
    description?.trim() ||
    (partyType === 'customer'
      ? `Customer discount — ${partyName}`
      : `Supplier discount received — ${partyName}`);

  let lines: JournalEntryLine[] = [];

  if (partyType === 'customer') {
    const arId = await resolveReceivablePostingAccountId(companyId, contactId);
    const discId = await ensureDiscountAllowedAccount(companyId);
    if (!arId || !discId) {
      return {
        journalEntryId: null,
        skipped: false,
        error: 'Accounts Receivable or Discount Allowed (5200) account not found.',
      };
    }
    lines = [
      {
        id: '',
        journal_entry_id: '',
        account_id: discId,
        debit: amt,
        credit: 0,
        description: baseDesc,
      },
      {
        id: '',
        journal_entry_id: '',
        account_id: arId,
        debit: 0,
        credit: amt,
        description: baseDesc,
      },
    ];
  } else {
    const apId = await resolvePayablePostingAccountId(companyId, contactId);
    const discRecvId = await resolveDiscountReceivedAccountId(companyId);
    if (!apId || !discRecvId) {
      return {
        journalEntryId: null,
        skipped: false,
        error: 'Accounts Payable or Discount Received (5210) account not found.',
      };
    }
    lines = [
      {
        id: '',
        journal_entry_id: '',
        account_id: apId,
        debit: amt,
        credit: 0,
        description: baseDesc,
      },
      {
        id: '',
        journal_entry_id: '',
        account_id: discRecvId,
        debit: 0,
        credit: amt,
        description: baseDesc,
      },
    ];
  }

  const entryNo = await documentNumberService.getNextJournalEntryNumber(companyId, branchSafe ?? null);
  const entry: JournalEntry = {
    id: '',
    company_id: companyId,
    branch_id: branchSafe,
    entry_no: entryNo,
    entry_date: dateStr,
    description: baseDesc,
    reference_type: 'party_discount',
    reference_id: contactId,
    created_by: createdBy ?? undefined,
    action_fingerprint: fp,
  };

  try {
    const saved = await accountingService.createEntry(entry, lines);
    const journalEntryId = (saved as { id?: string } | null)?.id ?? null;
    if (journalEntryId && typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('ledgerUpdated', {
          detail: {
            ledgerType: partyType === 'customer' ? 'customer' : 'supplier',
            entityId: contactId,
          },
        })
      );
    }
    return { journalEntryId, skipped: false };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to post discount journal entry.';
    return { journalEntryId: null, skipped: false, error: msg };
  }
}
