/**
 * Courier management (couriers table).
 * Used by: Shipment modal dropdown, Settings → Courier Management, Track Shipment URL.
 *
 * PART 5 – Courier API configuration (future integration):
 * - api_endpoint: URL for future "create shipment" API (e.g. POST to get tracking number).
 * - api_key: Stored for future auth when calling api_endpoint.
 * - tracking_url: Template for "Track Shipment" button; replace {tracking_id} with actual ID.
 * Future workflow: Create shipment → POST to courier api_endpoint → receive tracking_id → save to sale_shipments.
 * No API calls implemented yet; fields are stored for configuration only.
 */

import { supabase } from '@/lib/supabase';

export interface CourierRow {
  id: string;
  company_id: string;
  name: string;
  default_rate: number;
  tracking_url: string | null;
  api_endpoint: string | null;
  api_key: string | null;
  is_active: boolean;
  account_id: string | null;
  /** Single courier identity; same as ledger courier_id (accounts.contact_id). Use for all filters/dropdowns. */
  contact_id: string | null;
  created_at?: string;
}

export interface CourierFormPayload {
  name: string;
  default_rate?: number;
  tracking_url?: string;
  api_endpoint?: string;
  api_key?: string;
  is_active?: boolean;
}

export const courierService = {
  async getByCompanyId(companyId: string, activeOnly = true): Promise<CourierRow[]> {
    let q = supabase
      .from('couriers')
      .select('*')
      .eq('company_id', companyId)
      .order('name', { ascending: true });
    if (activeOnly) {
      q = q.eq('is_active', true);
    }
    const { data, error } = await q;
    if (error) throw error;
    return (data || []) as CourierRow[];
  },

  async getById(id: string): Promise<CourierRow | null> {
    const { data, error } = await supabase
      .from('couriers')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data as CourierRow | null;
  },

  /**
   * Create courier: Contact → Account → Courier (single identity = contact_id).
   * Step 1: Create contact (type=courier). Step 2: Create payable account with contact_id.
   * Step 3: Create courier row with contact_id and account_id.
   */
  async create(companyId: string, payload: CourierFormPayload): Promise<CourierRow> {
    const name = payload.name.trim();
    if (!name) throw new Error('Courier name is required');

    // Step 1: Create contact (type = courier)
    const { data: contact, error: contactErr } = await supabase
      .from('contacts')
      .insert({
        company_id: companyId,
        type: 'courier',
        name,
        is_active: true,
        is_default: false,
        opening_balance: 0,
        credit_limit: 0,
        payment_terms: 0,
      })
      .select('id')
      .single();
    if (contactErr || !contact) {
      throw new Error(contactErr?.message || 'Failed to create courier contact');
    }
    const contactId = contact.id;

    // Step 2: Create payable account (2031, 2032…) with contact_id
    const { data: accountId, error: rpcErr } = await supabase.rpc('get_or_create_courier_payable_account', {
      p_company_id: companyId,
      p_contact_id: contactId,
      p_contact_name: name,
    });
    if (rpcErr) throw new Error(rpcErr.message || 'Failed to create courier payable account');

    // Step 3: Create courier master with contact_id and account_id
    const row = {
      company_id: companyId,
      name,
      contact_id: contactId,
      account_id: accountId ?? null,
      default_rate: payload.default_rate ?? 0,
      tracking_url: payload.tracking_url?.trim() || null,
      api_endpoint: payload.api_endpoint?.trim() || null,
      api_key: payload.api_key?.trim() || null,
      is_active: payload.is_active ?? true,
    };
    const { data: courier, error: courierErr } = await supabase.from('couriers').insert(row).select().single();
    if (courierErr) throw courierErr;
    return courier as CourierRow;
  },

  async update(id: string, payload: Partial<CourierFormPayload>): Promise<CourierRow> {
    const update: Record<string, unknown> = {};
    if (payload.name !== undefined) update.name = payload.name.trim();
    if (payload.default_rate !== undefined) update.default_rate = payload.default_rate;
    if (payload.tracking_url !== undefined) update.tracking_url = payload.tracking_url?.trim() || null;
    if (payload.api_endpoint !== undefined) update.api_endpoint = payload.api_endpoint?.trim() || null;
    if (payload.api_key !== undefined) update.api_key = payload.api_key?.trim() || null;
    if (payload.is_active !== undefined) update.is_active = payload.is_active;
    const { data, error } = await supabase.from('couriers').update(update).eq('id', id).select().single();
    if (error) throw error;
    return data as CourierRow;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('couriers').delete().eq('id', id);
    if (error) throw error;
  },

  /**
   * Ensure a courier exists in couriers table by name (sync from ledger).
   * When ledger creates a payable account by name but couriers has no row, this inserts the row
   * with contact_id from the account so filter/dropdown use single identity.
   */
  async ensureCourierByName(companyId: string, name: string, accountId?: string | null): Promise<CourierRow | null> {
    if (!name?.trim()) return null;
    const trimmed = name.trim();
    const { data: existing } = await supabase
      .from('couriers')
      .select('*')
      .eq('company_id', companyId)
      .ilike('name', trimmed)
      .limit(1)
      .maybeSingle();
    if (existing) {
      const row = existing as CourierRow;
      if (accountId && !row.account_id) {
        const { data: acc } = await supabase.from('accounts').select('contact_id').eq('id', accountId).maybeSingle();
        await supabase.from('couriers').update({ account_id: accountId, contact_id: (acc as any)?.contact_id ?? row.contact_id }).eq('id', row.id);
        (row as any).account_id = accountId;
        if ((acc as any)?.contact_id) (row as any).contact_id = (acc as any).contact_id;
      }
      return row;
    }
    try {
      let contactId: string | null = null;
      if (accountId) {
        const { data: acc } = await supabase.from('accounts').select('contact_id').eq('id', accountId).maybeSingle();
        contactId = (acc as any)?.contact_id ?? null;
      }
      const { data: inserted, error } = await supabase
        .from('couriers')
        .insert({
          company_id: companyId,
          name: trimmed,
          default_rate: 0,
          is_active: true,
          account_id: accountId || null,
          contact_id: contactId,
        })
        .select()
        .single();
      if (error) throw error;
      return inserted as CourierRow;
    } catch {
      return null;
    }
  },

  /**
   * PART 6: Build tracking URL by replacing {tracking_id} in template with actual tracking ID.
   * Example: https://www.tcsexpress.com/track?trackingNo={tracking_id} + TCS123 → full URL.
   * Used to show "Track Shipment" button when courier.tracking_url and shipment tracking_id exist.
   */
  buildTrackingUrl(trackingUrlTemplate: string | null | undefined, trackingId: string | null | undefined): string | null {
    if (!trackingUrlTemplate?.trim() || !trackingId?.trim()) return null;
    return trackingUrlTemplate.replace(/\{tracking_id\}/gi, encodeURIComponent(trackingId.trim()));
  },
};
