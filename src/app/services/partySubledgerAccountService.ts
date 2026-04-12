/**
 * Control AR (1100) / AP (2000) + per-contact subledger accounts.
 * New document/payment postings resolve to the party child when possible; falls back to control.
 */

import { supabase } from '@/lib/supabase';
import { accountHelperService } from '@/app/services/accountHelperService';
import { accountService } from '@/app/services/accountService';

function slugFromContactCode(contactCode: string | null | undefined, contactId: string): string {
  if (contactCode) {
    // CUS-0004 → CUS0004, SUP-0001 → SUP0001
    return contactCode.replace(/-/g, '').toUpperCase();
  }
  // Fallback: short UUID slug (6 chars)
  return contactId.replace(/-/g, '').slice(0, 6).toUpperCase();
}

async function getContactRow(
  companyId: string,
  contactId: string
): Promise<{ id: string; name: string; type: string; code?: string | null } | null> {
  const { data, error } = await supabase
    .from('contacts')
    .select('id, name, type, code')
    .eq('company_id', companyId)
    .eq('id', contactId)
    .maybeSingle();
  if (error || !data) return null;
  return data as { id: string; name: string; type: string; code?: string | null };
}

/** Find existing party subledger: same contact + parent control (AR vs AP both-type contacts need two rows). */
async function findSubledgerByContact(companyId: string, contactId: string, parentControlId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('accounts')
    .select('id')
    .eq('company_id', companyId)
    .eq('linked_contact_id', contactId)
    .eq('parent_id', parentControlId)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();
  if (error) {
    if (import.meta.env?.DEV) console.warn('[partySubledgerAccountService] findSubledgerByContact:', error.message);
    return null;
  }
  return (data as { id?: string } | null)?.id ?? null;
}

/**
 * Ensure AR child under 1100 for customer/both. Returns null if column missing or not applicable.
 */
export async function ensureReceivableSubaccountForContact(companyId: string, contactId: string): Promise<string | null> {
  if (!companyId || !contactId) return null;
  const control = await accountHelperService.getAccountByCode('1100', companyId);
  if (!control?.id) return null;

  const existing = await findSubledgerByContact(companyId, contactId, control.id);
  if (existing) return existing;

  const contact = await getContactRow(companyId, contactId);
  if (!contact) return null;
  const t = String(contact.type || '').toLowerCase();
  if (!t.includes('customer') && t !== 'both') return null;

  const slug = slugFromContactCode(contact.code, contactId);
  const code = `AR-${slug}`;
  const name = `Receivable — ${contact.name}`.slice(0, 250);

  try {
    const created = await accountService.createAccount({
      company_id: companyId,
      code,
      name,
      type: 'asset',
      balance: 0,
      is_active: true,
      parent_id: control.id,
      linked_contact_id: contactId,
    });
    return created?.id ?? null;
  } catch (e: any) {
    if (String(e?.message || '').includes('linked_contact') || String(e?.code || '') === 'PGRST204') {
      try {
        const created = await accountService.createAccount({
          company_id: companyId,
          code,
          name,
          type: 'asset',
          balance: 0,
          is_active: true,
          parent_id: control.id,
        });
        return created?.id ?? null;
      } catch (e2) {
        if (import.meta.env?.DEV) console.warn('[partySubledgerAccountService] AR subaccount create fallback failed:', e2);
        return null;
      }
    }
    if (String(e?.message || '').toLowerCase().includes('unique') || String(e?.code || '') === '23505') {
      const { data: byCode } = await supabase
        .from('accounts')
        .select('id')
        .eq('company_id', companyId)
        .eq('code', code)
        .maybeSingle();
      return (byCode as { id?: string } | null)?.id ?? null;
    }
    if (import.meta.env?.DEV) console.warn('[partySubledgerAccountService] ensureReceivableSubaccountForContact:', e);
    return null;
  }
}

/**
 * Ensure AP child under 2000 for supplier/both.
 */
export async function ensurePayableSubaccountForContact(companyId: string, contactId: string): Promise<string | null> {
  if (!companyId || !contactId) return null;
  const control = await accountHelperService.getAccountByCode('2000', companyId);
  if (!control?.id) return null;

  const existing = await findSubledgerByContact(companyId, contactId, control.id);
  if (existing) return existing;

  const contact = await getContactRow(companyId, contactId);
  if (!contact) return null;
  const t = String(contact.type || '').toLowerCase();
  if (!t.includes('supplier') && t !== 'both') return null;

  const slug = slugFromContactCode(contact.code, contactId);
  const code = `AP-${slug}`;
  const name = `Payable — ${contact.name}`.slice(0, 250);

  try {
    const created = await accountService.createAccount({
      company_id: companyId,
      code,
      name,
      type: 'liability',
      balance: 0,
      is_active: true,
      parent_id: control.id,
      linked_contact_id: contactId,
    });
    return created?.id ?? null;
  } catch (e: any) {
    if (String(e?.message || '').includes('linked_contact') || String(e?.code || '') === 'PGRST204') {
      try {
        const created = await accountService.createAccount({
          company_id: companyId,
          code,
          name,
          type: 'liability',
          balance: 0,
          is_active: true,
          parent_id: control.id,
        });
        return created?.id ?? null;
      } catch (e2) {
        if (import.meta.env?.DEV) console.warn('[partySubledgerAccountService] AP subaccount create fallback failed:', e2);
        return null;
      }
    }
    if (String(e?.message || '').toLowerCase().includes('unique') || String(e?.code || '') === '23505') {
      const { data: byCode } = await supabase
        .from('accounts')
        .select('id')
        .eq('company_id', companyId)
        .eq('code', code)
        .maybeSingle();
      return (byCode as { id?: string } | null)?.id ?? null;
    }
    if (import.meta.env?.DEV) console.warn('[partySubledgerAccountService] ensurePayableSubaccountForContact:', e);
    return null;
  }
}

export async function ensurePartySubledgersForContact(
  companyId: string,
  contactId: string,
  type: 'customer' | 'supplier' | 'both' | 'worker' | string
): Promise<void> {
  const t = String(type || '').toLowerCase();
  if (t === 'customer' || t === 'both') await ensureReceivableSubaccountForContact(companyId, contactId);
  if (t === 'supplier' || t === 'both') await ensurePayableSubaccountForContact(companyId, contactId);
}

/** GL account id to use for customer AR lines (child if available, else 1100). */
export async function resolveReceivablePostingAccountId(
  companyId: string,
  customerContactId: string | null | undefined
): Promise<string | null> {
  const control = await accountHelperService.getAccountByCode('1100', companyId);
  if (!control?.id) return null;
  if (!customerContactId) return control.id;
  const child = await ensureReceivableSubaccountForContact(companyId, customerContactId);
  return child || control.id;
}

/** GL account id to use for supplier AP lines (child if available, else 2000). */
export async function resolvePayablePostingAccountId(
  companyId: string,
  supplierContactId: string | null | undefined
): Promise<string | null> {
  const control = await accountHelperService.getAccountByCode('2000', companyId);
  if (!control?.id) return null;
  if (!supplierContactId) return control.id;
  const child = await ensurePayableSubaccountForContact(companyId, supplierContactId);
  return child || control.id;
}
