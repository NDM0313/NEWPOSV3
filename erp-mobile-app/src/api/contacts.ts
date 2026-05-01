import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { normalizeCompanyId } from './contactBalancesUtils';
import type { ContactBalancesRow } from './contactBalancesRpc';
import {
  balanceRowFromMap,
  fetchContactPartyGlBalancesMap,
  fetchOperationalContactBalancesSummary,
  partyGlDueForListRole,
  partyGlSliceFromMap,
} from './contactBalancesRpc';

export type ContactRole = 'customer' | 'supplier' | 'worker';
export type BackendContactType = 'customer' | 'supplier' | 'both' | 'worker';

export interface ContactRow {
  id: string;
  company_id: string;
  type: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  city?: string | null;
  address?: string | null;
  opening_balance?: number | null;
  credit_limit?: number | null;
  worker_role?: string | null;
  current_balance?: number | null;
  is_active?: boolean;
}

export interface Contact {
  id: string;
  name: string;
  roles: ContactRole[];
  phone: string;
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

/** Operational RPC row → single display balance on customer/supplier/worker list (branch context). */
function balanceFromRpcRow(
  contactType: string,
  receivables: number,
  payables: number,
  listRole?: ContactRole
): number {
  const t = (contactType || '').toLowerCase();
  if (listRole === 'customer') {
    if (t === 'both') return Math.max(0, receivables);
    return Math.max(0, receivables);
  }
  if (listRole === 'supplier') {
    if (t === 'both') return Math.max(0, payables);
    return Math.max(0, payables);
  }
  if (listRole === 'worker') {
    return Math.max(0, payables);
  }
  if (t === 'supplier') return Math.max(0, payables);
  if (t === 'worker') return Math.max(0, payables);
  if (t === 'both') return Math.max(0, receivables) + Math.max(0, payables);
  return Math.max(0, receivables);
}

/**
 * Operational balances from `get_contact_balances_summary` (same as web Contacts when RPC exists).
 * Falls back to opening_balance only if RPC fails.
 */
export async function getContacts(
  companyId: string,
  type?: ContactRole,
  branchId?: string | null
): Promise<{ data: Contact[]; error: string | null }> {
  if (!isSupabaseConfigured) return { data: [], error: 'App not configured.' };
  const company = normalizeCompanyId(companyId);
  if (!company) return { data: [], error: 'Missing company.' };
  let query = supabase
    .from('contacts')
    .select('id, company_id, type, name, phone, email, city, address, opening_balance, credit_limit, worker_role, is_active, created_at, updated_at')
    .eq('company_id', company)
    .order('name');
  if (type === 'customer') query = query.in('type', ['customer', 'both']);
  else if (type === 'supplier') query = query.in('type', ['supplier', 'both']);
  else if (type === 'worker') query = query.eq('type', 'worker');
  const { data, error } = await query;
  if (error) return { data: [], error: error.message };

  const partyGl = await fetchContactPartyGlBalancesMap(company, branchId);
  const opFallBack =
    partyGl.error != null
      ? await fetchOperationalContactBalancesSummary(company, branchId)
      : { map: new Map<string, ContactBalancesRow>(), error: null as string | null };

  const listRole: ContactRole | undefined =
    type === 'customer' || type === 'supplier' || type === 'worker' ? type : undefined;

  const list: Contact[] = (data || []).map((row: ContactRow & { worker_role?: string; created_at?: string; updated_at?: string }) => {
    const opening = Number(row.opening_balance ?? 0);
    let balance = opening;

    if (!partyGl.error) {
      const slice = partyGlSliceFromMap(partyGl.map, row.id);
      if (slice) {
        if (listRole) {
          balance = partyGlDueForListRole(slice, listRole);
        } else {
          balance =
            Math.max(0, slice.glArReceivable) +
            Math.max(0, slice.glApPayable) +
            Math.max(0, slice.glWorkerPayable);
        }
      } else {
        balance = opening;
      }
    } else {
      const rpc = balanceRowFromMap(opFallBack.map, row.id);
      balance = rpc
        ? balanceFromRpcRow(row.type || 'customer', rpc.receivables, rpc.payables, listRole)
        : opening;
    }
    return {
      id: row.id,
      name: row.name,
      roles: typeToRoles(row.type || 'customer'),
      phone: row.phone || '',
      email: row.email ?? undefined,
      address: row.address ?? undefined,
      city: row.city ?? undefined,
      balance,
      creditLimit: row.credit_limit ? Number(row.credit_limit) : undefined,
      workerType: row.worker_role as Contact['workerType'],
      status: row.is_active !== false ? 'active' : 'inactive',
      createdAt: row.created_at ?? undefined,
      updatedAt: row.updated_at ?? undefined,
    };
  });
  return { data: list, error: null };
}

export interface CreateContactInput {
  name: string;
  phone: string;
  email?: string;
  city?: string;
  address?: string;
  roles: ContactRole[];
  openingBalance?: number;
  creditLimit?: number;
  workerType?: 'dyer' | 'stitcher' | 'master' | 'handwork' | 'other';
  workerRate?: number;
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
    phone: c.phone.trim(),
    email: c.email?.trim() || null,
    city: c.city?.trim() || null,
    address: c.address?.trim() || null,
    opening_balance: c.openingBalance ?? 0,
    credit_limit: c.creditLimit ?? null,
    is_active: true,
  };
  if (c.workerType) payload.worker_role = c.workerType;
  const { data, error } = await supabase.from('contacts').insert(payload).select().single();
  if (error) return { data: null, error: error.message };
  const row = data as ContactRow & { worker_role?: string };
  return {
    data: {
      id: row.id,
      name: row.name,
      roles: typeToRoles(row.type || 'customer'),
      phone: row.phone || '',
      email: row.email ?? undefined,
      city: row.city ?? undefined,
      address: row.address ?? undefined,
      balance: Number(row.opening_balance ?? 0),
      status: 'active',
    },
    error: null,
  };
}

export interface UpdateContactInput {
  name: string;
  phone: string;
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
    phone: c.phone.trim(),
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
      phone: r.phone || '',
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
