import { supabase, isSupabaseConfigured } from '../lib/supabase';

export type ContactRole = 'customer' | 'supplier' | 'worker';
export type BackendContactType = 'customer' | 'supplier' | 'both';

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
  status: 'active' | 'inactive';
}

function typeToRoles(t: string): ContactRole[] {
  if (t === 'customer') return ['customer'];
  if (t === 'supplier') return ['supplier'];
  return ['customer', 'supplier'];
}

function rolesToType(roles: ContactRole[]): BackendContactType {
  const hasC = roles.includes('customer');
  const hasS = roles.includes('supplier');
  const hasW = roles.includes('worker');
  if (hasC && !hasS && !hasW) return 'customer';
  if (hasS && !hasC && !hasW) return 'supplier';
  return 'both';
}

export async function getContacts(
  companyId: string,
  type?: ContactRole
): Promise<{ data: Contact[]; error: string | null }> {
  if (!isSupabaseConfigured) return { data: [], error: 'App not configured.' };
  let query = supabase
    .from('contacts')
    .select('id, company_id, type, name, phone, email, city, address, opening_balance, current_balance, is_active')
    .eq('company_id', companyId)
    .order('name');
  if (type === 'customer' || type === 'supplier') query = query.eq('type', type);
  const { data, error } = await query;
  if (error) return { data: [], error: error.message };
  const list: Contact[] = (data || []).map((row: ContactRow) => ({
    id: row.id,
    name: row.name,
    roles: typeToRoles(row.type || 'customer'),
    phone: row.phone || '',
    email: row.email ?? undefined,
    address: row.address ?? undefined,
    city: row.city ?? undefined,
    balance: Number(row.current_balance ?? row.opening_balance ?? 0),
    status: row.is_active !== false ? 'active' : 'inactive',
  }));
  return { data: list, error: null };
}

export async function createContact(
  companyId: string,
  c: { name: string; phone: string; email?: string; city?: string; roles: ContactRole[] }
): Promise<{ data: Contact | null; error: string | null }> {
  if (!isSupabaseConfigured) return { data: null, error: 'App not configured.' };
  const type = rolesToType(c.roles.length ? c.roles : ['customer']);
  const payload = {
    company_id: companyId,
    type,
    name: c.name.trim(),
    phone: c.phone.trim(),
    email: c.email?.trim() || null,
    city: c.city?.trim() || null,
    opening_balance: 0,
  };
  const { data, error } = await supabase.from('contacts').insert(payload).select().single();
  if (error) return { data: null, error: error.message };
  const row = data as ContactRow;
  return {
    data: {
      id: row.id,
      name: row.name,
      roles: typeToRoles(row.type || 'customer'),
      phone: row.phone || '',
      email: row.email ?? undefined,
      city: row.city ?? undefined,
      balance: 0,
      status: 'active',
    },
    error: null,
  };
}

export async function updateContact(
  id: string,
  c: { name: string; phone: string; email?: string; city?: string; roles: ContactRole[] }
): Promise<{ data: Contact | null; error: string | null }> {
  if (!isSupabaseConfigured) return { data: null, error: 'App not configured.' };
  const type = rolesToType(c.roles.length ? c.roles : ['customer']);
  const { data, error } = await supabase
    .from('contacts')
    .update({ type, name: c.name.trim(), phone: c.phone.trim(), email: c.email?.trim() || null, city: c.city?.trim() || null })
    .eq('id', id)
    .select()
    .single();
  if (error) return { data: null, error: error.message };
  const row = data as ContactRow;
  return {
    data: {
      id: row.id,
      name: row.name,
      roles: typeToRoles(row.type || 'customer'),
      phone: row.phone || '',
      email: row.email ?? undefined,
      city: row.city ?? undefined,
      balance: Number(row.current_balance ?? row.opening_balance ?? 0),
      status: row.is_active !== false ? 'active' : 'inactive',
    },
    error: null,
  };
}
