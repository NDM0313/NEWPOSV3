/**
 * Wholesale courier shipments (per packing list). Mirrors web courierShipmentService.
 */
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface CourierShipmentRow {
  id: string;
  company_id: string;
  packing_list_id: string;
  courier_id: string | null;
  tracking_number: string | null;
  shipment_cost: number;
  status: string;
  notes: string | null;
  booking_date?: string | null;
  expected_delivery_date?: string | null;
  dispatched_at?: string | null;
  delivered_at?: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  courier?: { id: string; name: string; tracking_url: string | null; account_id?: string | null } | null;
  packing_list?: {
    sale_id: string;
    sale?: {
      id: string;
      invoice_no?: string | null;
      order_no?: string | null;
      customer?: { name?: string; phone?: string; address?: string | null } | null;
    } | null;
  } | null;
}

export type EnrichedCourierShipment = CourierShipmentRow & {
  saleId: string;
  saleLabel: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
};

const ENRICHED_SELECT = `
  *,
  courier:couriers(id, name, tracking_url, account_id),
  packing_list:packing_lists(
    sale_id,
    sale:sales(
      id,
      invoice_no,
      order_no,
      customer:contacts(name, phone, address)
    )
  )
`;

function enrichRow(row: CourierShipmentRow): EnrichedCourierShipment {
  const sale = row.packing_list?.sale;
  const inv = sale?.invoice_no?.trim() || sale?.order_no?.trim() || '—';
  const cust = sale?.customer;
  return {
    ...row,
    saleId: row.packing_list?.sale_id ?? sale?.id ?? '',
    saleLabel: inv,
    customerName: cust?.name?.trim() || 'Walk-in',
    customerPhone: cust?.phone?.trim() || '—',
    customerAddress: cust?.address?.trim() || '—',
  };
}

export async function listCourierShipmentsByPackingList(
  packingListId: string,
): Promise<{ data: CourierShipmentRow[]; error: string | null }> {
  if (!isSupabaseConfigured) return { data: [], error: 'App not configured.' };
  const { data, error } = await supabase
    .from('courier_shipments')
    .select('*, courier:couriers(id, name, tracking_url, account_id)')
    .eq('packing_list_id', packingListId)
    .order('created_at', { ascending: false });
  if (error) return { data: [], error: error.message };
  return { data: (data || []) as CourierShipmentRow[], error: null };
}

export async function listCourierShipmentsEnriched(
  companyId: string,
  limit = 80,
): Promise<{ data: EnrichedCourierShipment[]; error: string | null }> {
  if (!isSupabaseConfigured) return { data: [], error: 'App not configured.' };
  const { data, error } = await supabase
    .from('courier_shipments')
    .select(ENRICHED_SELECT)
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return { data: [], error: error.message };
  return { data: ((data || []) as CourierShipmentRow[]).map(enrichRow), error: null };
}

export async function getCourierShipmentById(
  id: string,
): Promise<{ data: EnrichedCourierShipment | null; error: string | null }> {
  if (!isSupabaseConfigured) return { data: null, error: 'App not configured.' };
  const { data, error } = await supabase
    .from('courier_shipments')
    .select(ENRICHED_SELECT)
    .eq('id', id)
    .maybeSingle();
  if (error) return { data: null, error: error.message };
  if (!data) return { data: null, error: null };
  return { data: enrichRow(data as CourierShipmentRow), error: null };
}

export async function listCourierShipmentsByCompany(
  companyId: string,
  limit = 100,
): Promise<{ data: CourierShipmentRow[]; error: string | null }> {
  if (!isSupabaseConfigured) return { data: [], error: 'App not configured.' };
  const { data, error } = await supabase
    .from('courier_shipments')
    .select('*, courier:couriers(id, name, tracking_url), packing_list:packing_lists(sale_id)')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return { data: [], error: error.message };
  return { data: (data || []) as CourierShipmentRow[], error: null };
}

export async function createCourierShipment(payload: {
  companyId: string;
  packingListId: string;
  courierId?: string | null;
  trackingNumber?: string | null;
  shipmentCost?: number;
  status?: string;
  notes?: string | null;
  bookingDate?: string | null;
  expectedDeliveryDate?: string | null;
  createdBy?: string | null;
}): Promise<{ data: CourierShipmentRow | null; error: string | null }> {
  if (!isSupabaseConfigured) return { data: null, error: 'App not configured.' };
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('courier_shipments')
    .insert({
      company_id: payload.companyId,
      packing_list_id: payload.packingListId,
      courier_id: payload.courierId ?? null,
      tracking_number: payload.trackingNumber ?? null,
      shipment_cost: payload.shipmentCost ?? 0,
      status: payload.status ?? 'booked',
      notes: payload.notes ?? null,
      booking_date: payload.bookingDate ?? today,
      expected_delivery_date: payload.expectedDeliveryDate ?? null,
      created_by: payload.createdBy ?? null,
    })
    .select('*, courier:couriers(id, name, tracking_url)')
    .single();
  if (error) return { data: null, error: error.message };
  return { data: data as CourierShipmentRow, error: null };
}

export async function updateCourierShipment(
  id: string,
  updates: Partial<{
    courier_id: string | null;
    tracking_number: string | null;
    shipment_cost: number;
    status: string;
    notes: string | null;
    booking_date: string | null;
    expected_delivery_date: string | null;
  }>,
): Promise<{ data: CourierShipmentRow | null; error: string | null }> {
  if (!isSupabaseConfigured) return { data: null, error: 'App not configured.' };
  const patch: Record<string, unknown> = { ...updates, updated_at: new Date().toISOString() };
  if (updates.status === 'dispatched') patch.dispatched_at = new Date().toISOString();
  if (updates.status === 'delivered') patch.delivered_at = new Date().toISOString();
  const { data, error } = await supabase
    .from('courier_shipments')
    .update(patch)
    .eq('id', id)
    .select('*, courier:couriers(id, name, tracking_url)')
    .single();
  if (error) return { data: null, error: error.message };
  return { data: data as CourierShipmentRow, error: null };
}
