import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { getNextContactReferenceCode } from './documentNumber';
import { ensurePartySubledgersForContact } from './partySubledger';
import { isBrowserOffline, listCacheGet, listCacheKeys, listCacheSet } from '../lib/listCache';
import { normalizeCompanyId } from './contactBalancesUtils';
import {
  balanceRowFromMap,
  fetchContactPartyGlBalancesMap,
  fetchOperationalContactBalancesSummary,
  partyGlSliceFromMap,
  resolveContactListBalance,
} from './contactBalancesRpc';

export type ContactRole = 'customer' | 'supplier' | 'worker';
export type BackendContactType = 'customer' | 'supplier' | 'both' | 'worker';

export interface ContactRow {
  id: string;
  company_id: string;
  type: string;
  name: string;
  code?: string | null;
  phone?: string | null;
  mobile?: string | null;
  email?: string | null;
  city?: string | null;
  address?: string | null;
  opening_balance?: number | null;
  credit_limit?: number | null;
  worker_role?: string | null;
  current_balance?: number | null;
  is_active?: boolean;
  referral_code?: string | null;
  lead_source?: string | null;
  lead_status?: string | null;
  created_from?: string | null;
}

export interface Contact {
  id: string;
  name: string;
  roles: ContactRole[];
  phone: string;
  mobile?: string;
  email?: string;
  address?: string;
  city?: string;
  balance: number;
  creditLimit?: number;
  workerType?: 'dyer' | 'stitcher' | 'master' | 'handwork' | 'other';
  workerRate?: number;
  status: 'active' | 'inactive';
  createdAt?: string;
  updatedAt?: string;
  code?: string | null;
  referralCode?: string | null;
  leadSource?: string | null;
  leadStatus?: string | null;
  createdFrom?: string | null;
}

/** Primary phone for list/detail; falls back to mobile when phone is empty (matches web Contacts). */
export function getContactDisplayPhone(c: { phone?: string | null; mobile?: string | null }): string {
  const p = (c.phone ?? '').trim();
  if (p) return p;
  return (c.mobile ?? '').trim();
}

export function getContactPhoneLabel(c: { phone?: string | null; mobile?: string | null }): string {
  if ((c.phone ?? '').trim()) return 'Phone';
  if ((c.mobile ?? '').trim()) return 'Mobile';
  return 'Phone';
}

/** Prefer mobile for WhatsApp share; falls back to phone. */
export function getContactWhatsAppPhone(c: { phone?: string | null; mobile?: string | null }): string {
  const m = (c.mobile ?? '').trim();
  if (m) return m;
  return (c.phone ?? '').trim();
}

export function getContactDisplayRef(c: Pick<Contact, 'code' | 'referralCode'>): string {
  if (c.code?.trim()) return c.code.trim();
  if (c.referralCode?.trim()) return `Ref: ${c.referralCode.trim()}`;
  return '';
}

export function isPendingPublicLead(c: Pick<Contact, 'createdFrom' | 'leadStatus'>): boolean {
  return c.createdFrom === 'public_form' && c.leadStatus === 'New';
}

export async function approvePublicLead(
  contactId: string
): Promise<{ success: boolean; code?: string; error: string | null }> {
  if (!isSupabaseConfigured) return { success: false, error: 'App not configured.' };
  const { data, error } = await supabase.rpc('approve_public_contact_lead', { p_contact_id: contactId });
  if (error) return { success: false, error: error.message };
  const result = data as { success?: boolean; code?: string; error?: string };
  if (!result?.success) return { success: false, error: result?.error || 'Approval failed' };
  return { success: true, code: result.code, error: null };
}

function typeToRoles(t: string): ContactRole[] {
  if (t === 'customer') return ['customer'];
  if (t === 'supplier') return ['supplier'];
  if (t === 'worker') return ['worker'];
  return ['customer', 'supplier'];
}

function rolesToType(roles: ContactRole[]): BackendContactType {
  const hasC = roles.includes('customer');
  const hasS = roles.includes('supplier');
  const hasW = roles.includes('worker');
  if (hasW && !hasC && !hasS) return 'worker';
  if (hasC && !hasS && !hasW) return 'customer';
  if (hasS && !hasC && !hasW) return 'supplier';
  return 'both';
}

/**
 * Party list balances: GL when non-zero; operational fill when GL empty/zero/missing;
 * else opening_balance. Soft-fails empty GL maps (same as GL RPC error path).
 */
export async function getContacts(
  companyId: string,
  type?: ContactRole,
  branchId?: string | null
): Promise<{ data: Contact[]; error: string | null }> {
  if (!isSupabaseConfigured) return { data: [], error: 'App not configured.' };
  const company = normalizeCompanyId(companyId);
  if (!company) return { data: [], error: 'Missing company.' };
  const cacheKey = listCacheKeys.contacts(company, type ?? 'all', branchId ?? 'all');
  if (isBrowserOffline()) {
    const cached = await listCacheGet<Contact[]>(cacheKey);
    return {
      data: cached ?? [],
      error: cached?.length ? null : 'Offline: contacts not cached. Connect once while logged in.',
    };
  }
  let query = supabase
    .from('contacts')
    .select('id, company_id, type, name, phone, mobile, email, city, address, opening_balance, credit_limit, worker_role, is_active, created_at, updated_at, code, referral_code, lead_source, lead_status, created_from')
    .eq('company_id', company)
    .order('name');
  if (type === 'customer') query = query.in('type', ['customer', 'both']);
  else if (type === 'supplier') query = query.in('type', ['supplier', 'both']);
  else if (type === 'worker') query = query.eq('type', 'worker');
  const { data, error } = await query;
  if (error) return { data: [], error: error.message };

  const [partyGl, opSummary] = await Promise.all([
    fetchContactPartyGlBalancesMap(company, branchId),
    fetchOperationalContactBalancesSummary(company, branchId),
  ]);
  const glOk = partyGl.error == null;
  if (glOk && partyGl.map.size === 0 && (data || []).length > 0) {
    console.warn(
      '[ERP Mobile] get_contact_party_gl_balances returned zero rows; using operational fill where available.'
    );
  }

  const listRole: ContactRole | undefined =
    type === 'customer' || type === 'supplier' || type === 'worker' ? type : undefined;

  const list: Contact[] = (data || []).map((row: ContactRow & {
    worker_role?: string;
    created_at?: string;
    updated_at?: string;
    code?: string | null;
    referral_code?: string | null;
    lead_source?: string | null;
    lead_status?: string | null;
    created_from?: string | null;
  }) => {
    const opening = Number(row.opening_balance ?? 0);
    const balance = resolveContactListBalance({
      opening,
      contactType: row.type || 'customer',
      listRole,
      glOk,
      glSlice: partyGlSliceFromMap(partyGl.map, row.id),
      opRow: balanceRowFromMap(opSummary.map, row.id),
    });
    return {
      id: row.id,
      name: row.name,
      roles: typeToRoles(row.type || 'customer'),
      phone: (row.phone ?? '').trim(),
      mobile: (row.mobile ?? '').trim() || undefined,
      email: row.email ?? undefined,
      address: row.address ?? undefined,
      city: row.city ?? undefined,
      balance,
      creditLimit: row.credit_limit ? Number(row.credit_limit) : undefined,
      workerType: row.worker_role as Contact['workerType'],
      status: row.is_active !== false ? 'active' : 'inactive',
      createdAt: row.created_at ?? undefined,
      updatedAt: row.updated_at ?? undefined,
      code: row.code ?? null,
      referralCode: row.referral_code ?? null,
      leadSource: row.lead_source ?? null,
      leadStatus: row.lead_status ?? null,
      createdFrom: row.created_from ?? null,
    };
  });
  void listCacheSet(cacheKey, list);
  return { data: list, error: null };
}

export interface CreateContactInput {
  name: string;
  phone?: string;
  mobile?: string;
  email?: string;
  city?: string;
  address?: string;
  roles: ContactRole[];
  openingBalance?: number;
  creditLimit?: number;
  workerType?: 'dyer' | 'stitcher' | 'master' | 'handwork' | 'other';
  workerRate?: number;
}

function isContactCodeUniqueViolation(err: { code?: string; message?: string } | null): boolean {
  if (!err || err.code !== '23505') return false;
  const m = String(err.message || '').toLowerCase();
  return m.includes('idx_contacts_company_code_unique') || (m.includes('code') && m.includes('duplicate'));
}

function mapContactRow(row: ContactRow & { worker_role?: string }): Contact {
  return {
    id: row.id,
    name: row.name,
    roles: typeToRoles(row.type || 'customer'),
    phone: (row.phone ?? '').trim(),
    mobile: (row.mobile ?? '').trim() || undefined,
    email: row.email ?? undefined,
    city: row.city ?? undefined,
    address: row.address ?? undefined,
    balance: Number(row.opening_balance ?? 0),
    status: row.is_active === false ? 'inactive' : 'active',
    code: row.code ?? null,
    referralCode: row.referral_code ?? null,
    leadSource: row.lead_source ?? null,
    leadStatus: row.lead_status ?? null,
    createdFrom: row.created_from ?? null,
  };
}

export async function createContact(
  companyId: string,
  c: CreateContactInput
): Promise<{ data: Contact | null; error: string | null }> {
  if (!isSupabaseConfigured) return { data: null, error: 'App not configured.' };
  const type = rolesToType(c.roles.length ? c.roles : ['customer']);
  const payload: Record<string, unknown> = {
    company_id: companyId,
    type,
    name: c.name.trim(),
    phone: c.phone?.trim() || null,
    mobile: c.mobile?.trim() || null,
    email: c.email?.trim() || null,
    city: c.city?.trim() || null,
    address: c.address?.trim() || null,
    opening_balance: c.openingBalance ?? 0,
    credit_limit: c.creditLimit ?? null,
    is_active: true,
  };
  if (c.workerType) payload.worker_role = c.workerType;

  const { code: initialCode, error: codeErr } = await getNextContactReferenceCode(companyId, type);
  if (codeErr || !initialCode) {
    return { data: null, error: codeErr || 'Could not generate contact reference number.' };
  }
  payload.code = initialCode;

  const MAX_CODE_RETRIES = 3;
  let lastError: { code?: string; message?: string } | null = null;
  for (let attempt = 0; attempt < MAX_CODE_RETRIES; attempt++) {
    const { data, error } = await supabase.from('contacts').insert(payload).select().single();
    if (!error && data) {
      const row = data as ContactRow & { worker_role?: string };
      const { error: subErr } = await ensurePartySubledgersForContact(row.id);
      if (subErr) {
        console.warn('[createContact] party subledger ensure failed:', subErr);
      }
      return { data: mapContactRow(row), error: null };
    }
    lastError = error;
    if (isContactCodeUniqueViolation(error) && payload.code) {
      const { code: nextCode, error: retryErr } = await getNextContactReferenceCode(companyId, type);
      if (retryErr || !nextCode) {
        return { data: null, error: retryErr || 'Reference number conflict. Please try again.' };
      }
      payload.code = nextCode;
      continue;
    }
    break;
  }
  return { data: null, error: lastError?.message || 'Failed to create contact.' };
}

export interface UpdateContactInput {
  name: string;
  phone?: string;
  mobile?: string;
  email?: string;
  city?: string;
  address?: string;
  roles: ContactRole[];
  openingBalance?: number;
  creditLimit?: number;
  workerType?: 'dyer' | 'stitcher' | 'master' | 'handwork' | 'other';
  workerRate?: number;
  status?: 'active' | 'inactive';
}

export async function updateContact(
  id: string,
  c: UpdateContactInput
): Promise<{ data: Contact | null; error: string | null }> {
  if (!isSupabaseConfigured) return { data: null, error: 'App not configured.' };
  const type = rolesToType(c.roles.length ? c.roles : ['customer']);
  const payload: Record<string, unknown> = {
    type,
    name: c.name.trim(),
    phone: c.phone?.trim() || null,
    mobile: c.mobile?.trim() || null,
    email: c.email?.trim() || null,
    city: c.city?.trim() || null,
    address: c.address?.trim() || null,
    opening_balance: c.openingBalance ?? 0,
    credit_limit: c.creditLimit ?? null,
    is_active: c.status !== 'inactive',
  };
  if (c.workerType) payload.worker_role = c.workerType;
  const { data, error } = await supabase
    .from('contacts')
    .update(payload)
    .eq('id', id)
    .select()
    .single();
  if (error) return { data: null, error: error.message };
  const row = data as ContactRow;
  const r = row as ContactRow & { worker_role?: string; created_at?: string; updated_at?: string };
  return {
    data: {
      id: r.id,
      name: r.name,
      roles: typeToRoles(r.type || 'customer'),
      phone: (r.phone ?? '').trim(),
      mobile: (r.mobile ?? '').trim() || undefined,
      email: r.email ?? undefined,
      city: r.city ?? undefined,
      address: r.address ?? undefined,
      balance: Number(r.opening_balance ?? 0),
      creditLimit: r.credit_limit ? Number(r.credit_limit) : undefined,
      workerType: r.worker_role as Contact['workerType'],
      status: r.is_active !== false ? 'active' : 'inactive',
      createdAt: r.created_at ?? undefined,
      updatedAt: r.updated_at ?? undefined,
    },
    error: null,
  };
}

export async function deleteContact(id: string): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured) return { error: 'App not configured.' };
  const { error } = await supabase.from('contacts').delete().eq('id', id);
  return { error: error?.message ?? null };
}

const WALKING_CONTACT_SELECT =
  'id, company_id, type, name, phone, mobile, email, city, address, opening_balance, credit_limit, worker_role, is_active, created_at, updated_at, code, referral_code, lead_source, lead_status, created_from, is_system_generated, system_type, is_default';

type ContactDbRow = ContactRow & {
  created_at?: string | null;
  updated_at?: string | null;
  code?: string | null;
  referral_code?: string | null;
  lead_source?: string | null;
  lead_status?: string | null;
  created_from?: string | null;
};

function rowToContact(row: ContactDbRow): Contact {
  return {
    id: row.id,
    name: row.name,
    roles: typeToRoles(row.type || 'customer'),
    phone: (row.phone ?? '').trim(),
    mobile: (row.mobile ?? '').trim() || undefined,
    email: row.email ?? undefined,
    address: row.address ?? undefined,
    city: row.city ?? undefined,
    balance: Number(row.opening_balance ?? 0),
    creditLimit: row.credit_limit ? Number(row.credit_limit) : undefined,
    workerType: row.worker_role as Contact['workerType'],
    status: row.is_active !== false ? 'active' : 'inactive',
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined,
    code: row.code ?? null,
    referralCode: row.referral_code ?? null,
    leadSource: row.lead_source ?? null,
    leadStatus: row.lead_status ?? null,
    createdFrom: row.created_from ?? null,
  };
}

/** Walk-in / walking customer for POS and new sales (one per company). */
export async function getWalkingCustomer(
  companyId: string,
): Promise<{ data: Contact | null; error: string | null }> {
  if (!isSupabaseConfigured) return { data: null, error: 'App not configured.' };
  const company = normalizeCompanyId(companyId);
  if (!company) return { data: null, error: 'Missing company.' };

  const { data, error } = await supabase
    .from('contacts')
    .select(WALKING_CONTACT_SELECT)
    .eq('company_id', company)
    .eq('system_type', 'walking_customer')
    .in('type', ['customer', 'both'])
    .limit(1)
    .maybeSingle();
  if (error) return { data: null, error: error.message };
  if (data) return { data: rowToContact(data as ContactDbRow), error: null };

  const { data: legacy, error: legacyErr } = await supabase
    .from('contacts')
    .select(WALKING_CONTACT_SELECT)
    .eq('company_id', company)
    .eq('is_default', true)
    .in('type', ['customer', 'both'])
    .limit(1)
    .maybeSingle();
  if (legacyErr) return { data: null, error: legacyErr.message };
  if (!legacy) return { data: null, error: null };
  return { data: rowToContact(legacy as ContactDbRow), error: null };
}

/** Ensure system Walk-in Customer exists (same as web ERP). */
export async function ensureDefaultWalkingCustomerForCompany(companyId: string): Promise<void> {
  const existing = await getWalkingCustomer(companyId);
  if (existing.data) return;

  const company = normalizeCompanyId(companyId);
  if (!company || !isSupabaseConfigured) return;

  const { error } = await supabase.from('contacts').insert({
    company_id: company,
    type: 'customer',
    name: 'Walk-in Customer',
    code: 'CUS-0000',
    is_active: true,
    is_system_generated: true,
    system_type: 'walking_customer',
    is_default: true,
    opening_balance: 0,
    credit_limit: 0,
  });
  if (error && !String(error.message).toLowerCase().includes('duplicate')) {
    console.warn('[contacts] ensureDefaultWalkingCustomerForCompany:', error.message);
  }
}
